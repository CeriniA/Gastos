import { createHash } from 'node:crypto';
import {
  DOCUMENT_RETRY_DELAYS_MINUTES,
  MAX_ERROR_DETAIL,
  TEXT_LIMITS,
  TRANSIENT_DOCUMENT_ERRORS,
  PENDING_DOCUMENT_RETENTION_DAYS,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_FILES,
  MAX_UPLOAD_BYTES,
  extractionResultSchema,
  nameKey,
  pathOf,
  type Account,
  type Category,
  type CategoryRuleInput,
  type DocumentConfirm,
  type DocumentConfirmResult,
  type DocumentDetail,
  type DocumentErrorCode,
  type DocumentStatus,
  type DocumentSummary,
  type DocumentUpload,
  type DuplicateHint,
  type Installment,
  type IsoDate,
  type TransactionCreate,
} from '@gastos/shared';
import type { TransactionRunner, WriteOptions } from '../../core/db/transaction';
import { ConflictError, NotFoundError, fieldError } from '../../core/errors/errors';
import { extractionFailure, failureReason, type AiExtractor } from '../../providers/ai/aiExtractor';
import type { DocumentsRepository, StoredFile } from './documents.repository';
import { detectImageType } from './fileType';
import { applyCategorySuggestions } from './suggestions';

const MINUTE_MS = 60_000;

/** What the documents module needs from the rest of the app. */
export interface DocumentDependencies {
  /** Null when no AI key is configured: uploads are refused with a clear reason. */
  extractor: AiExtractor | null;
  listAccounts(): Promise<Account[]>;
  listCategories(options?: WriteOptions): Promise<Category[]>;
  /** Category id per normalised merchant name, from the user's rules. */
  ruleLookup(): Promise<Map<string, string>>;
  saveRule(rule: CategoryRuleInput, options: WriteOptions): Promise<unknown>;
  createTransactions(
    entries: readonly {
      input: TransactionCreate;
      installment: Installment | null;
      documentId: string;
    }[],
    options: WriteOptions,
  ): Promise<number>;
  /** For each candidate, whether a stored transaction has the same day, amount and currency. */
  findSameDayAmounts(
    candidates: readonly { date: string; amountCents: number; currency: string }[],
  ): Promise<boolean[]>;
  /** Transactions of a document that are not in the trash. */
  countLiveTransactions(documentId: string): Promise<number>;
  releaseTransactions(documentId: string, options: WriteOptions): Promise<void>;
  trashTransactions(documentId: string, options: WriteOptions): Promise<void>;
  runInTransaction: TransactionRunner;
  today(): IsoDate;
  now(): Date;
  /** Starts background work without waiting for it. */
  schedule(work: () => Promise<void>): void;
  onError(error: unknown, context: object): void;
}

export interface UploadedFile {
  originalName: string;
  content: Buffer;
}

const PENDING: readonly DocumentStatus[] = ['processing', 'ready', 'error'];

function toSummary(detail: DocumentDetail): DocumentSummary {
  const { extraction: _extraction, promptVersion: _promptVersion, ...summary } = detail;
  return summary;
}

export function createDocumentsService(repository: DocumentsRepository, deps: DocumentDependencies) {
  /** Only one document is read at a time: the free AI quota and 512 MB of memory both prefer it. */
  let processing = false;

  async function find(id: string): Promise<DocumentDetail> {
    const document = await repository.findById(id);
    if (!document) throw new NotFoundError('Document', id);
    return document;
  }

  /**
   * Marks the extracted transactions that look like repeats: same day, amount
   * and currency as a stored transaction, or as an earlier one in this same
   * document (overlapping screenshots). Only a hint: the user decides.
   */
  async function duplicateHints(document: DocumentDetail): Promise<DuplicateHint[]> {
    const read = document.extraction?.transactions ?? [];
    if (document.status !== 'ready') return [];

    const comparable = read.flatMap((transaction, index) =>
      transaction.date && transaction.amountCents !== null && transaction.currency
        ? [
            {
              index,
              date: transaction.date,
              amountCents: transaction.amountCents,
              currency: transaction.currency,
              // Two people can send the same amount on the same day: inside one document the other party tells them apart.
              party: nameKey(transaction.merchant),
            },
          ]
        : [],
    );
    const stored = await deps.findSameDayAmounts(comparable);
    const hints: DuplicateHint[] = read.map(() => null);
    const seen = new Set<string>();
    comparable.forEach((candidate, position) => {
      const key = `${candidate.date}|${candidate.amountCents}|${candidate.currency}|${candidate.party}`;
      if (stored[position]) hints[candidate.index] = 'existing';
      else if (seen.has(key)) hints[candidate.index] = 'repeated';
      seen.add(key);
    });
    return hints;
  }

  /** The document as the review screen needs it, with fresh duplicate hints. */
  async function get(id: string): Promise<DocumentDetail> {
    const document = await find(id);
    return { ...document, duplicateHints: await duplicateHints(document) };
  }

  const detailOf = (error: unknown) =>
    String(error instanceof Error ? error.message : error).slice(0, MAX_ERROR_DETAIL);

  async function fail(id: string, errorCode: DocumentErrorCode, error: unknown): Promise<void> {
    deps.onError(error, { documentId: id, errorCode });
    await repository.update(id, {
      status: 'error',
      errorCode,
      errorDetail: detailOf(error),
      retryAt: null,
      countAttempt: true,
    });
  }

  /**
   * The AI is out of quota or down: the document keeps waiting and is tried
   * again on its own later, unless it has already waited every delay.
   */
  async function waitOrFail(document: DocumentDetail, errorCode: DocumentErrorCode, error: unknown) {
    const delay = DOCUMENT_RETRY_DELAYS_MINUTES[document.waits];
    const transient = (TRANSIENT_DOCUMENT_ERRORS as readonly string[]).includes(errorCode);
    if (!transient || delay === undefined) {
      await fail(document.id, errorCode, error);
      return;
    }
    deps.onError(error, { documentId: document.id, errorCode, retryInMinutes: delay });
    await repository.update(document.id, {
      errorCode,
      errorDetail: detailOf(error),
      retryAt: new Date(deps.now().getTime() + delay * MINUTE_MS).toISOString(),
      waits: document.waits + 1,
      countAttempt: true,
    });
  }

  /** Sends one document to the AI and stores what came back, ready for review. */
  async function processOne(document: DocumentDetail): Promise<void> {
    if (!deps.extractor) {
      await fail(document.id, 'not_configured', extractionFailure('not_configured', 'No AI key configured'));
      return;
    }
    try {
      const [files, categories, rules] = await Promise.all([
        repository.findFiles(document.id),
        deps.listCategories(),
        deps.ruleLookup(),
      ]);
      if (files.length === 0) throw extractionFailure('unreadable', 'The document has no stored images');

      const raw = await deps.extractor.extract({
        kind: document.kind,
        files,
        categories: categories
          .filter((category) => !category.archived)
          .map((category) => ({
            id: category.id,
            kind: category.kind,
            path: pathOf(category.id, categories).join(' > '),
          })),
        today: deps.today(),
      });
      // Whatever the provider returned is checked like any other input.
      const checked = extractionResultSchema.safeParse(raw);
      if (!checked.success)
        throw extractionFailure('unreadable', 'The extraction does not match the contract');

      await repository.update(document.id, {
        status: 'ready',
        extraction: applyCategorySuggestions(checked.data, categories, rules),
        promptVersion: deps.extractor.promptVersion,
        errorCode: null,
        errorDetail: null,
        retryAt: null,
        waits: 0,
        countAttempt: true,
      });
    } catch (error) {
      await waitOrFail(document, failureReason(error) ?? 'unavailable', error);
    }
  }

  /**
   * Reads every waiting document, oldest first. Safe to call at any time: a
   * second call while one is running does nothing.
   */
  async function processQueue(): Promise<void> {
    if (processing) return;
    processing = true;
    const seen: string[] = [];
    try {
      for (;;) {
        const next = await repository.findNextToProcess(seen, deps.now());
        if (!next) break;
        seen.push(next.id);
        await processOne(next);
      }
    } finally {
      processing = false;
    }
  }

  const kick = () => deps.schedule(processQueue);

  return {
    get,
    processQueue,
    /**
     * Picks up documents a restart left half-way and those whose wait is
     * over. Called at startup, every minute while the server is awake, and
     * whenever the pending tray is looked at.
     */
    resume: kick,

    /**
     * Drops uploads nobody reviewed in PENDING_DOCUMENT_RETENTION_DAYS, with
     * their images. Confirmed documents are never touched.
     */
    purgeStale(now: Date = new Date()): Promise<number> {
      const cutoff = new Date(now.getTime() - PENDING_DOCUMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      return repository.deleteUnconfirmedBefore(cutoff);
    },

    async list(status: 'pending' | 'all'): Promise<DocumentSummary[]> {
      const documents = await repository.findByStatus(status === 'pending' ? PENDING : null);
      // A free server sleeps; looking at the tray is a good moment to try what was waiting.
      if (documents.some((document) => document.retryAt !== null)) kick();
      return documents.map(toSummary);
    },

    /**
     * Stores the upload and answers at once; the reading happens in the
     * background and the document shows up in the pending tray when ready.
     */
    async upload(input: DocumentUpload, uploads: readonly UploadedFile[]): Promise<DocumentSummary> {
      if (!deps.extractor) throw extractionFailure('not_configured', 'No AI key configured');
      if (uploads.length === 0) throw fieldError('files', 'Attach at least one image');
      if (uploads.length > MAX_DOCUMENT_FILES)
        throw fieldError('files', `Up to ${MAX_DOCUMENT_FILES} images per document`);

      const files: StoredFile[] = uploads.map((upload) => {
        const mimeType = detectImageType(upload.content);
        if (!mimeType) throw fieldError('files', 'Only JPG, PNG and WEBP images are accepted');
        if (upload.content.length > MAX_UPLOAD_BYTES) throw fieldError('files', 'Image too large');
        return { mimeType, content: upload.content };
      });
      const totalBytes = files.reduce((sum, file) => sum + file.content.length, 0);
      if (totalBytes > MAX_DOCUMENT_BYTES) throw fieldError('files', 'Images too large');

      if (input.accountId) {
        const account = (await deps.listAccounts()).find((candidate) => candidate.id === input.accountId);
        if (!account) throw fieldError('accountId', 'Account does not exist');
        if (account.archived) throw fieldError('accountId', 'Account is archived');
      }

      const hash = createHash('sha256');
      for (const file of files) hash.update(file.content);
      const sha256 = hash.digest('hex');
      const existing = await repository.findBySha256(sha256);
      // The check exists so the same receipt is not counted twice, and only a
      // confirmed document with transactions that still count can cause that.
      // Anything else makes way for the new upload, which is read afresh:
      // - not confirmed yet (waiting for review, or failed): nothing was stored from it;
      // - confirmed, but all its transactions were deleted: it counts for nothing.
      if (existing?.status === 'processing') return toSummary(existing); // Already on its way.
      if (existing) {
        const counted = existing.status === 'confirmed' ? await deps.countLiveTransactions(existing.id) : 0;
        if (counted > 0) {
          throw new ConflictError(
            'This file was already uploaded',
            { entity: 'Document', documentId: existing.id, status: existing.status },
            'DUPLICATE',
          );
        }
        await deps.runInTransaction(async (session) => {
          await deps.releaseTransactions(existing.id, { session });
          await repository.delete(existing.id, { session });
        });
      }

      const created = await repository.create({
        kind: input.kind,
        fileName: uploads[0]?.originalName.slice(0, TEXT_LIMITS.description) || 'document',
        sha256,
        accountId: input.accountId ?? null,
        files,
      });
      kick();
      return toSummary(created);
    },

    /** One of the stored images, for the review screen. */
    async getFile(id: string, index: number): Promise<StoredFile> {
      await find(id);
      const file = (await repository.findFiles(id))[index];
      if (!file) throw new NotFoundError('DocumentFile', `${id}/${index}`);
      return file;
    },

    /**
     * Sends a document to the AI again: one that failed, or one already read
     * whose result the user wants redone (the instructions may have improved).
     */
    async retry(id: string): Promise<DocumentSummary> {
      const document = await find(id);
      const waiting = document.status === 'processing' && document.retryAt !== null;
      if (document.status !== 'error' && document.status !== 'ready' && !waiting) {
        throw new ConflictError('Only a document waiting for review, or a failed one, can be read again');
      }
      // Asked by the user: right now, and with the automatic retries counted afresh.
      const updated = await repository.update(id, {
        status: 'processing',
        extraction: null,
        errorCode: null,
        errorDetail: null,
        retryAt: null,
        waits: 0,
      });
      kick();
      return toSummary(updated ?? document);
    },

    /**
     * Turns the reviewed extraction into transactions. One transaction of the
     * database: the transactions, the remembered rules and the document's new
     * state are all stored, or none is. The images are deleted here.
     */
    async confirm(id: string, input: DocumentConfirm): Promise<DocumentConfirmResult> {
      const document = await find(id);
      if (document.status !== 'ready')
        throw new ConflictError('Only a document ready for review can be confirmed');

      return deps.runInTransaction(async (session) => {
        const options = { session };
        const created = await deps.createTransactions(
          input.transactions.map((entry) => ({
            input: entry.transaction,
            installment: entry.installment ? { planId: null, ...entry.installment } : null,
            documentId: id,
          })),
          options,
        );
        for (const rule of input.rules) await deps.saveRule(rule, options);
        await repository.update(id, { status: 'confirmed', clearFiles: true }, options);
        return { created };
      });
    },

    /**
     * Deletes a document. Before confirmation this is "discard": nothing else
     * exists yet. After confirmation the caller chooses what happens to its
     * transactions: they stay as manual entries, or go to the trash.
     */
    async remove(id: string, transactions: 'keep' | 'delete'): Promise<void> {
      const document = await find(id);
      await deps.runInTransaction(async (session) => {
        const options = { session };
        if (document.status === 'confirmed') {
          if (transactions === 'delete') await deps.trashTransactions(id, options);
          else await deps.releaseTransactions(id, options);
        }
        await repository.delete(id, options);
      });
    },
  };
}

export type DocumentsService = ReturnType<typeof createDocumentsService>;
