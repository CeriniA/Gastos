import {
  firstDayOfMonth,
  givenBack,
  lastDayOfMonth,
  spendingCents,
  type Account,
  type CurrencyTotals,
  type CardPeriod,
  type DocumentDetail,
  type InstallmentPlan,
  type Institution,
  type ExtractionResult,
  type Tag,
  type Transaction,
} from '@gastos/shared';
import type { DbSession, TransactionRunner } from '../core/db/transaction';
import type { AccountsRepository } from '../modules/accounts/accounts.repository';
import type { CardPeriodsRepository } from '../modules/card-periods/cardPeriods.repository';
import type { CategoriesRepository, CategoryRow } from '../modules/categories/categories.repository';
import type { CategoryRulesRepository, StoredRule } from '../modules/category-rules/categoryRules.repository';
import type { DocumentsRepository, StoredFile } from '../modules/documents/documents.repository';
import type { InstallmentPlansRepository } from '../modules/installment-plans/installmentPlans.repository';
import type { InstitutionsRepository } from '../modules/institutions/institutions.repository';
import type { TagsRepository } from '../modules/tags/tags.repository';
import { duplicateKey, installmentKey } from '../modules/transactions/duplicateKey';
import type { TransactionsRepository } from '../modules/transactions/transactions.repository';
import type { AiExtractor, ExtractionInput } from '../providers/ai/aiExtractor';
import type { PdfReadError, PdfTextReader } from '../providers/pdf/pdfReader';
import { wireServices } from '../wiring';

/**
 * The whole backend running in memory: the real services, wired exactly as in
 * production, over repositories that keep their data in arrays. Tests use it
 * to exercise business rules end to end without a database.
 *
 * Transactions are simulated with a snapshot that is put back if the work
 * throws, so "all or nothing" behaviour can be tested too.
 */

interface Store {
  accounts: Account[];
  institutions: Institution[];
  cardPeriods: CardPeriod[];
  installmentPlans: InstallmentPlan[];
  categories: CategoryRow[];
  tags: Tag[];
  transactions: Transaction[];
  rules: StoredRule[];
  documents: (DocumentDetail & { sha256: string; files: StoredFile[] })[];
}

const STAMP = '2026-10-01T00:00:00.000Z';
/** The only public rate the test backend knows: reais to pesos. */
const TEST_BRL_ARS_RATE = 300;

export function createMemoryBackend(today = '2026-10-10', options: { aiConfigured?: boolean } = {}) {
  /** The clock the services see. Tests move it forward to make waiting documents due. */
  const clock = { now: new Date(`${today}T12:00:00.000Z`) };
  /** The calendar day the services see. Tests move it to make installments come due. */
  const calendar = { today };
  const store: Store = {
    accounts: [],
    institutions: [],
    cardPeriods: [],
    installmentPlans: [],
    categories: [],
    tags: [],
    transactions: [],
    rules: [],
    documents: [],
  };
  /** Switches a test can flip to make a write fail, to check that work is rolled back. */
  const faults = { insertTransactions: false };

  /**
   * A scripted AI: tests set what the next reading returns (or the error it
   * throws) and can look at what the service sent.
   */
  const ai: { result: ExtractionResult; error: Error | null; calls: ExtractionInput[] } = {
    result: { documentKind: 'receipt', transactions: [], statement: null, warnings: [] },
    error: null,
    calls: [],
  };
  const extractor: AiExtractor = {
    promptVersion: 1,
    async extract(input) {
      ai.calls.push(input);
      if (ai.error) throw ai.error;
      return ai.result;
    },
  };
  /** A scripted PDF library: tests set the pages the next PDF has, or the error it throws. */
  const pdf: { pages: string[]; error: PdfReadError | null; passwords: (string | undefined)[] } = {
    pages: [],
    error: null,
    passwords: [],
  };
  const pdfReader: PdfTextReader = {
    async read(_content, options) {
      pdf.passwords.push(options.password);
      if (pdf.error) throw pdf.error;
      return { pages: pdf.pages };
    },
  };
  const errors: { error: unknown; context: object }[] = [];
  let sequence = 0;
  const nextId = () => {
    sequence += 1;
    return sequence.toString(16).padStart(24, '0');
  };
  const stamps = { createdAt: STAMP, updatedAt: STAMP };

  const runInTransaction: TransactionRunner = async (work, existing) => {
    if (existing) return work(existing);
    const snapshot = structuredClone(store);
    try {
      return await work({} as DbSession);
    } catch (error) {
      Object.assign(store, snapshot);
      throw error;
    }
  };

  const accounts: AccountsRepository = {
    async findAll() {
      return [...store.accounts];
    },
    async findById(id) {
      return store.accounts.find((account) => account.id === id) ?? null;
    },
    async findByNameKey(key) {
      return store.accounts.find((account) => keys.get(account.id) === key) ?? null;
    },
    async create(data) {
      const { nameKey, ...rest } = data;
      const account: Account = { ...rest, id: nextId(), archived: false, ...stamps };
      keys.set(account.id, nameKey);
      store.accounts.push(account);
      return account;
    },
    async update(id, changes) {
      const index = store.accounts.findIndex((account) => account.id === id);
      const current = store.accounts[index];
      if (!current) return null;
      const { nameKey, ...rest } = changes;
      if (nameKey !== undefined) keys.set(id, nameKey);
      const next = { ...current, ...rest };
      store.accounts[index] = next;
      return next;
    },
    async countByInstitution(institutionId) {
      return store.accounts.filter(
        (account) => account.bankId === institutionId || account.networkId === institutionId,
      ).length;
    },
    async delete(id) {
      const before = store.accounts.length;
      store.accounts = store.accounts.filter((account) => account.id !== id);
      return store.accounts.length < before;
    },
  };
  /** Normalised names, which the real repositories keep in a `nameKey` field. */
  const keys = new Map<string, string>();

  const cardPeriods: CardPeriodsRepository = {
    async findAll() {
      return [...store.cardPeriods].sort((a, b) => b.closingDate.localeCompare(a.closingDate));
    },
    async findByAccount(accountId) {
      return store.cardPeriods
        .filter((period) => period.accountId === accountId)
        .sort((a, b) => b.closingDate.localeCompare(a.closingDate));
    },
    async findById(id) {
      return store.cardPeriods.find((period) => period.id === id) ?? null;
    },
    async create(accountId, data) {
      const period: CardPeriod = { ...data, id: nextId(), accountId, ...stamps };
      store.cardPeriods.push(period);
      return period;
    },
    async clearDocument(documentId) {
      store.cardPeriods = store.cardPeriods.map((period) =>
        period.documentId === documentId ? { ...period, documentId: null } : period,
      );
    },
    async update(id, changes) {
      const index = store.cardPeriods.findIndex((period) => period.id === id);
      const current = store.cardPeriods[index];
      if (!current) return null;
      const next = { ...current, ...changes };
      store.cardPeriods[index] = next;
      return next;
    },
    async delete(id) {
      store.cardPeriods = store.cardPeriods.filter((period) => period.id !== id);
    },
    async countByAccount(accountId) {
      return store.cardPeriods.filter((period) => period.accountId === accountId).length;
    },
  };

  const installmentPlans: InstallmentPlansRepository = {
    async findById(id) {
      return store.installmentPlans.find((plan) => plan.id === id) ?? null;
    },
    async create(data) {
      const plan: InstallmentPlan = { ...data, id: nextId(), ...stamps };
      store.installmentPlans.push(plan);
      return plan;
    },
    async countByAccount(accountId) {
      return store.installmentPlans.filter((plan) => plan.accountId === accountId).length;
    },
  };

  const institutions: InstitutionsRepository = {
    async findAll() {
      return [...store.institutions].sort(
        (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
      );
    },
    async findById(id) {
      return store.institutions.find((institution) => institution.id === id) ?? null;
    },
    async findByNameKey(kind, key) {
      return (
        store.institutions.find(
          (institution) => institution.kind === kind && keys.get(institution.id) === key,
        ) ?? null
      );
    },
    async create(data) {
      const { nameKey, ...rest } = data;
      const institution: Institution = { ...rest, id: nextId(), archived: false, ...stamps };
      keys.set(institution.id, nameKey);
      store.institutions.push(institution);
      return institution;
    },
    async update(id, changes) {
      const index = store.institutions.findIndex((institution) => institution.id === id);
      const current = store.institutions[index];
      if (!current) return null;
      const { nameKey, ...rest } = changes;
      if (nameKey !== undefined) keys.set(id, nameKey);
      const next = { ...current, ...rest };
      store.institutions[index] = next;
      return next;
    },
    async delete(id) {
      store.institutions = store.institutions.filter((institution) => institution.id !== id);
    },
  };

  const categories: CategoriesRepository = {
    async findAll() {
      return [...store.categories];
    },
    async create(data) {
      const { nameKey: _nameKey, ...rest } = data;
      const row: CategoryRow = { ...rest, id: nextId(), archived: false, ...stamps };
      store.categories.push(row);
      return row;
    },
    async update(id, changes) {
      const index = store.categories.findIndex((category) => category.id === id);
      const current = store.categories[index];
      if (!current) return null;
      const { nameKey: _nameKey, ...rest } = changes;
      const next = { ...current, ...rest };
      store.categories[index] = next;
      return next;
    },
    async delete(id) {
      store.categories = store.categories.filter((category) => category.id !== id);
    },
  };

  const tags: TagsRepository = {
    async findAll() {
      return [...store.tags];
    },
    async findById(id) {
      return store.tags.find((tag) => tag.id === id) ?? null;
    },
    async findByNameKey(key) {
      return store.tags.find((tag) => keys.get(tag.id) === key) ?? null;
    },
    async create(data) {
      const tag: Tag = { id: nextId(), name: data.name, ...stamps };
      keys.set(tag.id, data.nameKey);
      store.tags.push(tag);
      return tag;
    },
    async rename(id, data) {
      const index = store.tags.findIndex((tag) => tag.id === id);
      const current = store.tags[index];
      if (!current) return null;
      keys.set(id, data.nameKey);
      const next = { ...current, name: data.name };
      store.tags[index] = next;
      return next;
    },
    async delete(id) {
      store.tags = store.tags.filter((tag) => tag.id !== id);
    },
  };

  const usesCategory = (transaction: Transaction, ids: readonly string[]) =>
    (transaction.categoryId !== null && ids.includes(transaction.categoryId)) ||
    transaction.splits.some((split) => ids.includes(split.categoryId));

  const transactions: TransactionsRepository = {
    async find(query) {
      const text = query.q?.toLowerCase();
      const matching = store.transactions
        .filter((transaction) => (transaction.deletedAt !== null) === Boolean(query.deleted))
        .filter(
          (transaction) =>
            !query.month ||
            (transaction.paymentDate >= firstDayOfMonth(query.month) &&
              transaction.paymentDate <= lastDayOfMonth(query.month)),
        )
        .filter((transaction) => !query.from || transaction.date >= query.from)
        .filter((transaction) => !query.to || transaction.date <= query.to)
        .filter((transaction) => !query.type || transaction.type === query.type)
        .filter((transaction) => !query.source || transaction.source === query.source)
        .filter((transaction) => !query.tagId || transaction.tagIds.includes(query.tagId))
        .filter(
          (transaction) =>
            !query.accountId ||
            transaction.accountId === query.accountId ||
            transaction.toAccountId === query.accountId,
        )
        .filter((transaction) => !query.categoryIds?.length || usesCategory(transaction, query.categoryIds))
        .filter(
          (transaction) =>
            !text ||
            transaction.description.toLowerCase().includes(text) ||
            transaction.note.toLowerCase().includes(text),
        )
        .sort((a, b) => b.date.localeCompare(a.date));
      const start = (query.page - 1) * query.pageSize;
      return {
        items: matching.slice(start, start + query.pageSize),
        page: query.page,
        pageSize: query.pageSize,
        total: matching.length,
      };
    },
    async findAllForExport(range) {
      return store.transactions
        .filter((transaction) => transaction.deletedAt === null)
        .filter((transaction) => !range.from || transaction.date >= range.from)
        .filter((transaction) => !range.to || transaction.date <= range.to)
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    async findById(id) {
      return store.transactions.find((transaction) => transaction.id === id) ?? null;
    },
    async insertMany(records) {
      if (faults.insertTransactions) throw new Error('simulated write failure');
      const created = records.map((record) => ({ ...record, id: nextId(), ...stamps, deletedAt: null }));
      store.transactions.push(...created);
      return created;
    },
    async replace(id, record) {
      const index = store.transactions.findIndex(
        (transaction) => transaction.id === id && !transaction.deletedAt,
      );
      const current = store.transactions[index];
      if (!current) return null;
      const next = { ...current, ...record };
      store.transactions[index] = next;
      return next;
    },
    async setDeleted(id, deletedAt) {
      const index = store.transactions.findIndex((transaction) => transaction.id === id);
      const current = store.transactions[index];
      if (!current || (deletedAt === null) === (current.deletedAt === null)) return false;
      store.transactions[index] = { ...current, deletedAt: deletedAt ? deletedAt.toISOString() : null };
      return true;
    },
    async deleteTrashed(id) {
      const before = store.transactions.length;
      store.transactions = store.transactions.filter(
        (transaction) => transaction.id !== id || transaction.deletedAt === null,
      );
      return before !== store.transactions.length;
    },
    async purgeDeletedBefore(cutoff) {
      const before = store.transactions.length;
      store.transactions = store.transactions.filter(
        (transaction) => transaction.deletedAt === null || new Date(transaction.deletedAt) >= cutoff,
      );
      return before - store.transactions.length;
    },
    async countByAccount(accountId) {
      return store.transactions.filter(
        (transaction) => transaction.accountId === accountId || transaction.toAccountId === accountId,
      ).length;
    },
    async countByCategory(categoryId) {
      return store.transactions.filter((transaction) => usesCategory(transaction, [categoryId])).length;
    },
    async moveCategory(fromId, toId) {
      store.transactions = store.transactions.map((transaction) => ({
        ...transaction,
        categoryId: transaction.categoryId === fromId ? toId : transaction.categoryId,
        splits: transaction.splits.map((split) =>
          split.categoryId === fromId ? { ...split, categoryId: toId } : split,
        ),
      }));
    },
    async installmentKeys(amounts) {
      return new Set(
        store.transactions.flatMap((transaction) =>
          transaction.deletedAt === null &&
          transaction.installment &&
          amounts.includes(transaction.amountCents)
            ? [installmentKey(transaction.installment, transaction.amountCents, transaction.currency)]
            : [],
        ),
      );
    },
    async amountKeysOn(dates) {
      const keys = new Set<string>();
      for (const transaction of store.transactions) {
        if (transaction.deletedAt !== null || !dates.includes(transaction.date)) continue;
        keys.add(duplicateKey(transaction.date, transaction.amountCents, transaction.currency));
        if (transaction.original) {
          keys.add(
            duplicateKey(transaction.date, transaction.original.amountCents, transaction.original.currency),
          );
        }
      }
      return keys;
    },
    async countLiveByDocument(documentId) {
      return store.transactions.filter(
        (transaction) => transaction.documentId === documentId && transaction.deletedAt === null,
      ).length;
    },
    async releaseDocument(documentId) {
      store.transactions = store.transactions.map((transaction) =>
        transaction.documentId === documentId
          ? { ...transaction, documentId: null, source: 'manual' }
          : transaction,
      );
    },
    async trashByDocument(documentId, deletedAt) {
      store.transactions = store.transactions.map((transaction) =>
        transaction.documentId === documentId && transaction.deletedAt === null
          ? { ...transaction, documentId: null, deletedAt: deletedAt.toISOString() }
          : transaction,
      );
    },
    async findPaymentDates(accountId) {
      return store.transactions
        .filter((transaction) => transaction.accountId === accountId)
        .map(({ id, date, paymentDate }) => ({ id, date, paymentDate }));
    },
    async setPaymentDates(updates) {
      const byId = new Map(updates.map((update) => [update.id, update.paymentDate]));
      store.transactions = store.transactions.map((transaction) =>
        byId.has(transaction.id) ? { ...transaction, paymentDate: byId.get(transaction.id)! } : transaction,
      );
    },
    async findCharges(accountId) {
      return store.transactions
        .filter((transaction) => transaction.accountId === accountId && transaction.deletedAt === null)
        .filter((transaction) => transaction.status !== 'draft' && transaction.type !== 'transfer')
        .map((transaction) => ({
          date: transaction.date,
          paymentDate: transaction.paymentDate,
          signedCents: transaction.type === 'expense' ? spendingCents(transaction) : -transaction.amountCents,
        }));
    },
    async confirmProjectedUpTo(date) {
      let count = 0;
      store.transactions = store.transactions.map((transaction) => {
        if (transaction.status !== 'projected' || transaction.date > date) return transaction;
        count += 1;
        return { ...transaction, status: 'confirmed' };
      });
      return count;
    },
    async trashByPlan(planId, deletedAt) {
      let count = 0;
      store.transactions = store.transactions.map((transaction) => {
        if (transaction.installment?.planId !== planId || transaction.deletedAt !== null) return transaction;
        count += 1;
        return { ...transaction, deletedAt: deletedAt.toISOString() };
      });
      return count;
    },
    async pullTag(tagId) {
      store.transactions = store.transactions.map((transaction) => ({
        ...transaction,
        tagIds: transaction.tagIds.filter((id) => id !== tagId),
      }));
    },
    async findItems(range) {
      return store.transactions
        .filter((transaction) => transaction.deletedAt === null && transaction.status === 'confirmed')
        .filter((transaction) => transaction.type === 'expense')
        .filter((transaction) => !range.from || transaction.date >= range.from)
        .filter((transaction) => !range.to || transaction.date <= range.to)
        .sort((a, b) => b.date.localeCompare(a.date))
        .flatMap((transaction) =>
          transaction.items.map((item) => ({
            transactionId: transaction.id,
            date: transaction.date,
            description: transaction.description,
            currency: transaction.currency,
            ...givenBack(item, transaction.refund),
          })),
        );
    },
    async findLastRate(currency) {
      const [latest] = store.transactions
        .filter(
          (transaction) => transaction.deletedAt === null && transaction.original?.currency === currency,
        )
        .sort((a, b) => b.date.localeCompare(a.date));
      return { rate: latest?.original?.rate ?? null, date: latest?.date ?? null };
    },
    async totalsByMonth(month) {
      const totals = new Map<string, CurrencyTotals>();
      for (const transaction of store.transactions) {
        const counted =
          transaction.deletedAt === null &&
          transaction.status === 'confirmed' &&
          transaction.type !== 'transfer' &&
          transaction.paymentDate >= firstDayOfMonth(month) &&
          transaction.paymentDate <= lastDayOfMonth(month);
        if (!counted) continue;
        const entry = totals.get(transaction.currency) ?? {
          currency: transaction.currency,
          incomeCents: 0,
          expenseCents: 0,
          balanceCents: 0,
        };
        if (transaction.type === 'income') entry.incomeCents += transaction.amountCents;
        else entry.expenseCents += spendingCents(transaction);
        entry.balanceCents = entry.incomeCents - entry.expenseCents;
        totals.set(transaction.currency, entry);
      }
      return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
    },
    async duplicateKeys(range) {
      return new Set(
        store.transactions
          .filter((transaction) => transaction.deletedAt === null)
          .filter((transaction) => transaction.date >= range.from && transaction.date <= range.to)
          .filter((transaction) => range.accountIds.includes(transaction.accountId))
          .flatMap((transaction) =>
            [transaction.amountCents, ...transaction.splits.map((split) => split.amountCents)].map(
              (amountCents) => duplicateKey(transaction.date, amountCents, transaction.accountId),
            ),
          ),
      );
    },
  };

  const categoryRules: CategoryRulesRepository = {
    async findAll() {
      return [...store.rules].sort((a, b) => a.merchantKey.localeCompare(b.merchantKey));
    },
    async upsert(data) {
      const index = store.rules.findIndex((rule) => rule.merchantKey === data.merchantKey);
      const current = store.rules[index];
      const next: StoredRule = current ? { ...current, ...data } : { ...data, id: nextId(), ...stamps };
      if (current) store.rules[index] = next;
      else store.rules.push(next);
      return next;
    },
    async delete(id) {
      const before = store.rules.length;
      store.rules = store.rules.filter((rule) => rule.id !== id);
      return store.rules.length < before;
    },
    async deleteByCategory(categoryId) {
      store.rules = store.rules.filter((rule) => rule.categoryId !== categoryId);
    },
    async moveCategory(fromId, toId) {
      store.rules = store.rules.map((rule) =>
        rule.categoryId === fromId ? { ...rule, categoryId: toId } : rule,
      );
    },
  };

  const withoutBytes = (document: Store['documents'][number]): DocumentDetail => {
    const { sha256: _sha256, files, ...detail } = document;
    return {
      ...detail,
      text: null,
      duplicateHints: [],
      fileCount: files.length,
      transactionCount: detail.extraction?.transactions.length ?? null,
    };
  };

  const documents: DocumentsRepository = {
    async create(data) {
      sequence += 1; // Later uploads sort after earlier ones.
      const document: Store['documents'][number] = {
        id: nextId(),
        kind: data.kind,
        status: 'processing',
        fileName: data.fileName,
        fileCount: data.files.length,
        accountId: data.accountId,
        errorCode: null,
        retryAt: null,
        waits: 0,
        transactionCount: null,
        extraction: null,
        text: data.text,
        duplicateHints: [],
        promptVersion: null,
        createdAt: new Date(Date.parse(STAMP) + sequence * 1000).toISOString(),
        updatedAt: STAMP,
        sha256: data.sha256,
        files: [...data.files],
      };
      store.documents.push(document);
      return withoutBytes(document);
    },
    async findById(id) {
      const document = store.documents.find((candidate) => candidate.id === id);
      return document ? withoutBytes(document) : null;
    },
    async findBySha256(sha256) {
      const document = store.documents.find((candidate) => candidate.sha256 === sha256);
      return document ? withoutBytes(document) : null;
    },
    async findByStatus(statuses) {
      return store.documents
        .filter((document) => !statuses || statuses.includes(document.status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(withoutBytes);
    },
    async findNextToProcess(excludeIds, now) {
      const [next] = store.documents
        .filter((document) => document.status === 'processing' && !excludeIds.includes(document.id))
        .filter((document) => document.retryAt === null || new Date(document.retryAt) <= now)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return next ? withoutBytes(next) : null;
    },
    async findFiles(id) {
      return store.documents.find((document) => document.id === id)?.files ?? [];
    },
    async findText(id) {
      return store.documents.find((document) => document.id === id)?.text ?? null;
    },
    async update(id, changes) {
      const index = store.documents.findIndex((document) => document.id === id);
      const current = store.documents[index];
      if (!current) return null;
      const { countAttempt: _countAttempt, clearFiles, errorDetail: _errorDetail, ...fields } = changes;
      const next = clearFiles ? { ...current, ...fields, files: [], text: null } : { ...current, ...fields };
      store.documents[index] = next;
      return withoutBytes(next);
    },
    async deleteUnconfirmedBefore(cutoff) {
      const before = store.documents.length;
      store.documents = store.documents.filter(
        (document) => document.status === 'confirmed' || new Date(document.createdAt) >= cutoff,
      );
      return before - store.documents.length;
    },
    async delete(id) {
      store.documents = store.documents.filter((document) => document.id !== id);
    },
  };

  const services = wireServices(
    {
      accounts,
      cardPeriods,
      categories,
      categoryRules,
      documents,
      installmentPlans,
      institutions,
      tags,
      transactions,
    },
    {
      runInTransaction,
      today: () => calendar.today,
      now: () => clock.now,
      extractor: options.aiConfigured === false ? null : extractor,
      pdfReader,
      rates: {
        // A fixed table instead of the network.
        reference: async (from, to) =>
          from === 'BRL' && to === 'ARS'
            ? { rate: TEST_BRL_ARS_RATE, from, to, asOf: today, source: 'test' }
            : null,
      },
      // Tests decide when the background work runs: await app.documents.processQueue().
      schedule: () => undefined,
      onError: (error, context) => errors.push({ error, context }),
    },
  );
  return { ...services, store, runInTransaction, faults, ai, pdf, errors, clock, calendar };
}
