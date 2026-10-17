import { createHash } from 'node:crypto';
import {
  DOCUMENT_RETRY_DELAYS_MINUTES,
  MAX_ERROR_DETAIL,
  TEXT_LIMITS,
  TRANSIENT_DOCUMENT_ERRORS,
  PENDING_DOCUMENT_RETENTION_DAYS,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_FILES,
  MAX_STATEMENT_PAGES,
  MAX_STATEMENT_ROWS,
  MAX_STATEMENT_TEXT_LENGTH,
  MAX_UPLOAD_BYTES,
  extractionResultSchema,
  nameKey,
  pathOf,
  redactPersonalData,
  type Account,
  type CardPeriodCreate,
  type Category,
  type CategoryRuleInput,
  type DocumentConfirm,
  type DocumentConfirmResult,
  type DocumentDetail,
  type DocumentErrorCode,
  type DocumentStatus,
  type DocumentSummary,
  type DocumentKind,
  type DocumentUpload,
  type DuplicateHint,
  type Installment,
  type IsoDate,
  type ProductRuleInput,
  type StatementPreview,
  type StatementUpload,
  type TransactionCreate,
} from '@gastos/shared';
import type { TransactionRunner, WriteOptions } from '../../core/db/transaction';
import { ConflictError, NotFoundError, fieldError } from '../../core/errors/errors';
import { extractionFailure, failureReason, type AiExtractor } from '../../providers/ai/aiExtractor';
import { PdfReadError, type PdfFailure, type PdfTextReader } from '../../providers/pdf/pdfReader';
import type { DocumentsRepository, StoredFile } from './documents.repository';
import { detectImageType } from './fileType';
import { dateInstallmentsOnClosing, tidyStatementText } from './statement';
import { decodeText, rowsToText, statementFileType } from './statementFile';
import { applyCategorySuggestions, applyProductRules } from './suggestions';

const MINUTE_MS = 60_000;

/** The field and the message each reason a PDF could not be read is reported with. */
const PDF_FAILURE_FIELDS: Record<PdfFailure, { path: string; message: string }> = {
  password_required: { path: 'password', message: 'The PDF is protected with a password' },
  wrong_password: { path: 'password', message: 'The PDF password is wrong' },
  too_many_pages: { path: 'file', message: 'The PDF has too many pages for a statement' },
  unreadable: { path: 'file', message: 'The PDF could not be read' },
};

/** What the documents module needs from the rest of the app. */
export interface DocumentDependencies {
  /** Null when no AI key is configured: uploads are refused with a clear reason. */
  extractor: AiExtractor | null;
  pdfReader: PdfTextReader;
  /** The rows of an Excel file's first sheet, each as its cells. */
  readSpreadsheet(content: Buffer): Promise<{ cells: unknown[] }[]>;
  listAccounts(): Promise<Account[]>;
  listCategories(options?: WriteOptions): Promise<Category[]>;
  /** Category id per normalised merchant name, from the user's rules. */
  ruleLookup(): Promise<Map<string, string>>;
  /** Product and group the user taught for each printed receipt line, by its normalised text. */
  productRuleLookup(): Promise<Map<string, Pick<ProductRuleInput, 'product' | 'group'>>>;
  saveProductRule(rule: ProductRuleInput, options: WriteOptions): Promise<unknown>;
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
  /** Stores the closing and due dates read from a card statement, linked to it. */
  createCardPeriods(
    periods: readonly CardPeriodCreate[],
    documentId: string,
    options: WriteOptions,
  ): Promise<unknown>;
  /** The card periods read from a document stop pointing at it; their dates stay. */
  releaseCardPeriods(documentId: string, options: WriteOptions): Promise<void>;
  /** Creates the plan of an installment first seen on a statement, with the installments to come. */
  continueInstallments(
    input: { transaction: TransactionCreate; number: number; total: number },
    options: WriteOptions,
  ): Promise<{ id: string }>;
  /** For each candidate, whether a live transaction is already that installment of that amount. */
  findInstallments(
    candidates: readonly { number: number; total: number; amountCents: number; currency: string }[],
  ): Promise<boolean[]>;
  /**
   * Counts one more document sent to the AI by the running user, or throws
   * once they reached their daily limit: everybody shares one AI quota.
   */
  takeAiReading(): Promise<void>;
  runInTransaction: TransactionRunner;
  today(): IsoDate;
  now(): Date;
  /** Starts background work without waiting for it. */
  schedule(work: () => Promise<void>): void;
  /** Whose documents the running code works on: each user has their own queue. */
  owner(): string;
  onError(error: unknown, context: object): void;
}

export interface UploadedFile {
  originalName: string;
  content: Buffer;
}

const PENDING: readonly DocumentStatus[] = ['processing', 'ready', 'error'];

function toSummary(detail: DocumentDetail): DocumentSummary {
  const { extraction: _extraction, promptVersion: _promptVersion, text: _text, ...summary } = detail;
  return summary;
}

export function createDocumentsService(repository: DocumentsRepository, deps: DocumentDependencies) {
  /**
   * Each user's documents are read one at a time: the free AI quota and 512 MB
   * of memory both prefer it. These are the users whose queue is running.
   */
  const processing = new Set<string>();

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
    // An installment a statement charges may already be stored, projected by
    // an earlier statement or typed by hand, on another day than the one read.
    const installments = read.flatMap((transaction, index) =>
      transaction.installment && transaction.amountCents !== null && transaction.currency
        ? [
            {
              index,
              ...transaction.installment,
              amountCents: transaction.amountCents,
              currency: transaction.currency,
            },
          ]
        : [],
    );
    const [stored, storedInstallments] = await Promise.all([
      deps.findSameDayAmounts(comparable),
      deps.findInstallments(installments),
    ]);
    const hints: DuplicateHint[] = read.map(() => null);
    installments.forEach((candidate, position) => {
      if (storedInstallments[position]) hints[candidate.index] = 'existing';
    });
    const seen = new Set<string>();
    comparable.forEach((candidate, position) => {
      const key = `${candidate.date}|${candidate.amountCents}|${candidate.currency}|${candidate.party}`;
      if (stored[position]) hints[candidate.index] = 'existing';
      else if (seen.has(key)) hints[candidate.index] ??= 'repeated';
      seen.add(key);
    });
    return hints;
  }

  /** The document as the review screen needs it, with its text and fresh duplicate hints. */
  async function get(id: string): Promise<DocumentDetail> {
    const document = await find(id);
    const [text, hints] = await Promise.all([repository.findText(id), duplicateHints(document)]);
    return { ...document, text, duplicateHints: hints };
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
      const [files, text, categories, rules, productRules] = await Promise.all([
        repository.findFiles(document.id),
        repository.findText(document.id),
        deps.listCategories(),
        deps.ruleLookup(),
        deps.productRuleLookup(),
      ]);
      if (files.length === 0 && !text)
        throw extractionFailure('unreadable', 'The document has nothing stored to read');

      const raw = await deps.extractor.extract({
        kind: document.kind,
        files,
        text,
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
        extraction: applyProductRules(
          applyCategorySuggestions(dateInstallmentsOnClosing(checked.data), categories, rules),
          productRules,
        ),
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
    const owner = deps.owner();
    if (processing.has(owner)) return;
    processing.add(owner);
    const seen: string[] = [];
    try {
      for (;;) {
        const next = await repository.findNextToProcess(seen, deps.now());
        if (!next) break;
        seen.push(next.id);
        await processOne(next);
      }
    } finally {
      processing.delete(owner);
    }
  }

  const kick = () => deps.schedule(processQueue);

  /** Links stored from a document are cut before it is deleted, so nothing points at it. */
  async function detach(documentId: string, options: WriteOptions): Promise<void> {
    await deps.releaseTransactions(documentId, options);
    await deps.releaseCardPeriods(documentId, options);
  }

  /** Keeps a new upload, images or text, and starts reading it. */
  async function store(data: {
    kind: DocumentKind;
    fileName: string;
    sha256: string;
    accountId: string | null;
    files: StoredFile[];
    text: string | null;
  }): Promise<DocumentSummary> {
    if (data.accountId) {
      const account = (await deps.listAccounts()).find((candidate) => candidate.id === data.accountId);
      if (!account) throw fieldError('accountId', 'Account does not exist');
      if (account.archived) throw fieldError('accountId', 'Account is archived');
    }

    const existing = await repository.findBySha256(data.sha256);
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
    }
    // Counted before anything is replaced: past the daily limit, the pending
    // document the new upload would replace stays as it was.
    await deps.takeAiReading();
    if (existing) {
      await deps.runInTransaction(async (session) => {
        await detach(existing.id, { session });
        await repository.delete(existing.id, { session });
      });
    }

    const created = await repository.create({
      ...data,
      fileName: data.fileName.slice(0, TEXT_LIMITS.description) || 'document',
    });
    kick();
    return toSummary(created);
  }

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

      const hash = createHash('sha256');
      for (const file of files) hash.update(file.content);
      return store({
        kind: input.kind,
        fileName: uploads[0]?.originalName ?? '',
        sha256: hash.digest('hex'),
        accountId: input.accountId ?? null,
        files,
        text: null,
      });
    },

    /**
     * First step of reading a statement (a card's, a bank's, an app's): the
     * text of its PDF, Excel or CSV file, with the personal data that has a
     * recognisable shape already hidden. Nothing is stored and nothing goes
     * to the AI: the user reads it, hides what is left (a name, an address)
     * and sends it with uploadStatement.
     */
    async previewStatement(content: Buffer | null, password: string | undefined): Promise<StatementPreview> {
      if (!deps.extractor) throw extractionFailure('not_configured', 'No AI key configured');
      if (!content) throw fieldError('file', 'Attach the statement file');
      const fileType = statementFileType(content);
      if (fileType === 'old_excel')
        throw fieldError('file', 'Old Excel files (.xls) are not accepted: save it as .xlsx or CSV');
      if (fileType === null) throw fieldError('file', 'Only PDF, Excel (.xlsx) and CSV files are accepted');

      let pages: string[];
      if (fileType === 'pdf') {
        try {
          ({ pages } = await deps.pdfReader.read(content, { password, maxPages: MAX_STATEMENT_PAGES }));
        } catch (error) {
          if (!(error instanceof PdfReadError)) throw error;
          if (error.reason === 'unreadable') deps.onError(error, { step: 'statement_preview' });
          const { path, message } = PDF_FAILURE_FIELDS[error.reason];
          throw fieldError(path, message);
        }
      } else if (fileType === 'xlsx') {
        let rows: { cells: unknown[] }[];
        try {
          rows = await deps.readSpreadsheet(content);
        } catch (error) {
          deps.onError(error, { step: 'statement_preview' });
          throw fieldError('file', 'The spreadsheet could not be read');
        }
        if (rows.length > MAX_STATEMENT_ROWS)
          throw fieldError('file', 'The file has too many rows for a statement');
        pages = [rowsToText(rows)];
      } else {
        pages = [decodeText(content)];
      }
      const text = tidyStatementText(pages);
      // A scanned statement is a picture inside a PDF: there is no text to read.
      if (!/\p{L}/u.test(text)) {
        throw fieldError(
          'file',
          fileType === 'pdf' ? 'The PDF has no text: it is a scanned image' : 'The file has no text',
        );
      }
      const redacted = redactPersonalData(text);
      if (redacted.text.length > MAX_STATEMENT_TEXT_LENGTH)
        throw fieldError('file', 'The file has too much text for a statement');
      return { text: redacted.text, pages: pages.length, hidden: redacted.hidden, fileType };
    },

    /** Second step: the text the user approved is stored and read in the background, like an image. */
    async uploadStatement(
      input: Omit<StatementUpload, 'kind'> & Partial<Pick<StatementUpload, 'kind'>>,
    ): Promise<DocumentSummary> {
      if (!deps.extractor) throw extractionFailure('not_configured', 'No AI key configured');
      return store({
        kind: input.kind ?? 'card_statement',
        fileName: input.fileName,
        sha256: createHash('sha256').update(input.text).digest('hex'),
        accountId: input.accountId ?? null,
        files: [],
        text: input.text,
      });
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
      await deps.takeAiReading();
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
     * state are all stored, or none is. The images or the text are deleted here.
     */
    async confirm(id: string, input: DocumentConfirm): Promise<DocumentConfirmResult> {
      const document = await find(id);
      if (document.status !== 'ready')
        throw new ConflictError('Only a document ready for review can be confirmed');

      if (input.cardPeriods.length > 0 && document.kind !== 'card_statement')
        throw fieldError('cardPeriods', 'Only a card statement brings closing dates');

      return deps.runInTransaction(async (session) => {
        const options = { session };
        // The dates first: the purchases stored next take their payment date from them.
        if (input.cardPeriods.length > 0) await deps.createCardPeriods(input.cardPeriods, id, options);
        const entries = [];
        for (const entry of input.transactions) {
          const plan =
            entry.continuePlan && entry.installment
              ? await deps.continueInstallments(
                  { transaction: entry.transaction, ...entry.installment },
                  options,
                )
              : null;
          entries.push({
            input: entry.transaction,
            installment: entry.installment ? { planId: plan?.id ?? null, ...entry.installment } : null,
            documentId: id,
          });
        }
        const created = await deps.createTransactions(entries, options);
        for (const rule of input.rules) await deps.saveRule(rule, options);
        for (const rule of input.productRules) await deps.saveProductRule(rule, options);
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
          await deps.releaseCardPeriods(id, options);
        }
        await repository.delete(id, options);
      });
    },
  };
}

export type DocumentsService = ReturnType<typeof createDocumentsService>;
