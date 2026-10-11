import {
  firstDayOfMonth,
  lastDayOfMonth,
  type Account,
  type CurrencyTotals,
  type Tag,
  type Transaction,
} from '@gastos/shared';
import type { DbSession, TransactionRunner } from '../core/db/transaction';
import type { AccountsRepository } from '../modules/accounts/accounts.repository';
import type { CategoriesRepository, CategoryRow } from '../modules/categories/categories.repository';
import type { TagsRepository } from '../modules/tags/tags.repository';
import { duplicateKey } from '../modules/transactions/duplicateKey';
import type { TransactionsRepository } from '../modules/transactions/transactions.repository';
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
  categories: CategoryRow[];
  tags: Tag[];
  transactions: Transaction[];
}

const STAMP = '2026-10-01T00:00:00.000Z';

export function createMemoryBackend(today = '2026-10-10') {
  const store: Store = { accounts: [], categories: [], tags: [], transactions: [] };
  /** Switches a test can flip to make a write fail, to check that work is rolled back. */
  const faults = { insertTransactions: false };
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
    async delete(id) {
      const before = store.accounts.length;
      store.accounts = store.accounts.filter((account) => account.id !== id);
      return store.accounts.length < before;
    },
  };
  /** Normalised names, which the real repositories keep in a `nameKey` field. */
  const keys = new Map<string, string>();

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
    async pullTag(tagId) {
      store.transactions = store.transactions.map((transaction) => ({
        ...transaction,
        tagIds: transaction.tagIds.filter((id) => id !== tagId),
      }));
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
        else entry.expenseCents += transaction.amountCents;
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
          .map((transaction) =>
            duplicateKey(transaction.date, transaction.amountCents, transaction.accountId),
          ),
      );
    },
  };

  const services = wireServices({ accounts, categories, tags, transactions }, runInTransaction, () => today);
  return { ...services, store, faults };
}
