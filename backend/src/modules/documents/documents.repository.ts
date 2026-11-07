import type {
  DocumentDetail,
  DocumentErrorCode,
  DocumentKind,
  DocumentStatus,
  ReviewExtraction,
} from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { idString, toObjectId, toObjectIdOrNull } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { DocumentModel, type DocumentDoc } from './documents.model';

export interface StoredFile {
  mimeType: string;
  content: Buffer;
}

export interface DocumentChanges {
  status?: DocumentStatus;
  extraction?: ReviewExtraction | null;
  promptVersion?: number | null;
  errorCode?: DocumentErrorCode | null;
  errorDetail?: string | null;
  retryAt?: string | null;
  waits?: number;
  /** Adds one to the number of reading attempts. */
  countAttempt?: boolean;
}

/** Pending documents are few; the list is capped so a forgotten pile cannot slow it down. */
const LIST_LIMIT = 200;

/** A document without its image bytes or text, which are only loaded when needed. */
type LightDoc = Omit<DocumentDoc, 'files' | 'text'> & { files: { mimeType: string }[] };
const WITHOUT_BYTES = { 'files.data': 0, text: 0 } as const;

function toDetail(doc: LightDoc): DocumentDetail {
  const extraction = (doc.extraction ?? null) as ReviewExtraction | null;
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    status: doc.status,
    fileName: doc.fileName,
    fileCount: doc.files?.length ?? 0,
    accountId: idString(doc.accountId),
    errorCode: doc.errorCode ?? null,
    retryAt: doc.retryAt ? doc.retryAt.toISOString() : null,
    waits: doc.waits ?? 0,
    transactionCount: extraction ? extraction.transactions.length : null,
    extraction,
    text: null,
    duplicateHints: [],
    promptVersion: doc.promptVersion ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** The driver hands binary fields back as BSON Binary objects, not Buffers. */
function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  const binary = data as { buffer?: Uint8Array };
  return Buffer.from(binary.buffer ?? (data as Uint8Array));
}

export const documentsPort = createCollectionPort(DocumentModel, [
  { field: 'accountId', to: COLLECTIONS.accounts },
]);

export const documentsRepository = {
  async create(data: {
    kind: DocumentKind;
    fileName: string;
    sha256: string;
    accountId: string | null;
    files: readonly StoredFile[];
    text: string | null;
  }): Promise<DocumentDetail> {
    const doc = await DocumentModel.create({
      kind: data.kind,
      status: 'processing',
      fileName: data.fileName,
      sha256: data.sha256,
      accountId: toObjectIdOrNull(data.accountId),
      files: data.files.map((file) => ({ mimeType: file.mimeType, data: file.content })),
      text: data.text,
    });
    return toDetail(doc.toObject() as DocumentDoc);
  },

  async findById(id: string, options: WriteOptions = {}): Promise<DocumentDetail | null> {
    const doc = await DocumentModel.findById(toObjectId(id), WITHOUT_BYTES, { session: options.session }).lean<LightDoc>();
    return doc ? toDetail(doc) : null;
  },

  async findBySha256(sha256: string): Promise<DocumentDetail | null> {
    const doc = await DocumentModel.findOne({ sha256 }, WITHOUT_BYTES).lean<LightDoc>();
    return doc ? toDetail(doc) : null;
  },

  /** Newest first. */
  async findByStatus(statuses: readonly DocumentStatus[] | null): Promise<DocumentDetail[]> {
    const filter = statuses ? { status: { $in: [...statuses] } } : {};
    const docs = await DocumentModel.find(filter, WITHOUT_BYTES)
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .lean<LightDoc[]>();
    return docs.map(toDetail);
  },

  /**
   * The document that has waited longest for the AI, if any. One waiting for
   * the AI to have room again only counts once its time has come.
   */
  async findNextToProcess(excludeIds: readonly string[], now: Date): Promise<DocumentDetail | null> {
    const doc = await DocumentModel.findOne(
      {
        status: 'processing',
        _id: { $nin: excludeIds.map(toObjectId) },
        $or: [{ retryAt: null }, { retryAt: { $lte: now } }],
      },
      WITHOUT_BYTES,
    )
      .sort({ createdAt: 1 })
      .lean<LightDoc>();
    return doc ? toDetail(doc) : null;
  },

  async findFiles(id: string): Promise<StoredFile[]> {
    const doc = await DocumentModel.findById(toObjectId(id), { files: 1 }).lean<Pick<DocumentDoc, 'files'>>();
    return (doc?.files ?? []).map((file) => ({ mimeType: file.mimeType, content: toBuffer(file.data) }));
  },

  /** A card statement's text; null for images. Documents stored before statements existed have none. */
  async findText(id: string): Promise<string | null> {
    const doc = await DocumentModel.findById(toObjectId(id), { text: 1 }).lean<Pick<DocumentDoc, 'text'>>();
    return doc?.text ?? null;
  },

  async update(
    id: string,
    changes: DocumentChanges,
    options: WriteOptions = {},
  ): Promise<DocumentDetail | null> {
    const { countAttempt, retryAt, ...rest } = changes;
    const fields = {
      ...rest,
      ...(retryAt === undefined ? {} : { retryAt: retryAt ? new Date(retryAt) : null }),
    };
    const doc = await DocumentModel.findByIdAndUpdate(
      toObjectId(id),
      {
        $set: fields,
        ...(countAttempt ? { $inc: { attempts: 1 } } : {}),
      },
      { new: true, session: options.session, projection: WITHOUT_BYTES },
    ).lean<LightDoc>();
    return doc ? toDetail(doc) : null;
  },

  /**
   * Confirms a document, and deletes what was stored to read it (the images or
   * the text), only if it is still waiting for review. The condition is the
   * guard against a second confirmation, or a deletion, happening at the same
   * time: whoever comes second finds it already gone and gets null. It also
   * holds when MongoDB retries the transaction, because the filter is evaluated
   * again.
   */
  async markConfirmed(id: string, options: WriteOptions = {}): Promise<DocumentDetail | null> {
    const doc = await DocumentModel.findOneAndUpdate(
      { _id: toObjectId(id), status: 'ready' },
      { $set: { status: 'confirmed', files: [], text: null } },
      { new: true, session: options.session, projection: WITHOUT_BYTES },
    ).lean<LightDoc>();
    return doc ? toDetail(doc) : null;
  },

  /** Deletes uploads that were never confirmed and are older than the cutoff. */
  async deleteUnconfirmedBefore(cutoff: Date): Promise<number> {
    const result = await DocumentModel.deleteMany({
      status: { $ne: 'confirmed' },
      createdAt: { $lt: cutoff },
    });
    return result.deletedCount;
  },

  async delete(id: string, options: WriteOptions = {}): Promise<void> {
    await DocumentModel.deleteOne({ _id: toObjectId(id) }, { session: options.session });
  },
};

export type DocumentsRepository = typeof documentsRepository;
