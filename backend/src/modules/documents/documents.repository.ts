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
  /** Adds one to the number of reading attempts. */
  countAttempt?: boolean;
  /** Deletes the stored images. */
  clearFiles?: boolean;
}

/** A document without its image bytes, which are only loaded when needed. */
type LightDoc = Omit<DocumentDoc, 'files'> & { files: { mimeType: string }[] };
const WITHOUT_BYTES = { 'files.data': 0 } as const;

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
    transactionCount: extraction ? extraction.transactions.length : null,
    extraction,
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
  }): Promise<DocumentDetail> {
    const doc = await DocumentModel.create({
      kind: data.kind,
      status: 'processing',
      fileName: data.fileName,
      sha256: data.sha256,
      accountId: toObjectIdOrNull(data.accountId),
      files: data.files.map((file) => ({ mimeType: file.mimeType, data: file.content })),
    });
    return toDetail(doc.toObject() as DocumentDoc);
  },

  async findById(id: string): Promise<DocumentDetail | null> {
    const doc = await DocumentModel.findById(toObjectId(id), WITHOUT_BYTES).lean<LightDoc>();
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
      .limit(200)
      .lean<LightDoc[]>();
    return docs.map(toDetail);
  },

  /** The document that has waited longest for the AI, if any. */
  async findNextToProcess(excludeIds: readonly string[]): Promise<DocumentDetail | null> {
    const doc = await DocumentModel.findOne(
      { status: 'processing', _id: { $nin: excludeIds.map(toObjectId) } },
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

  async update(
    id: string,
    changes: DocumentChanges,
    options: WriteOptions = {},
  ): Promise<DocumentDetail | null> {
    const { countAttempt, clearFiles, ...fields } = changes;
    const doc = await DocumentModel.findByIdAndUpdate(
      toObjectId(id),
      {
        $set: { ...fields, ...(clearFiles ? { files: [] } : {}) },
        ...(countAttempt ? { $inc: { attempts: 1 } } : {}),
      },
      { new: true, session: options.session, projection: WITHOUT_BYTES },
    ).lean<LightDoc>();
    return doc ? toDetail(doc) : null;
  },

  async delete(id: string, options: WriteOptions = {}): Promise<void> {
    await DocumentModel.deleteOne({ _id: toObjectId(id) }, { session: options.session });
  },
};

export type DocumentsRepository = typeof documentsRepository;
