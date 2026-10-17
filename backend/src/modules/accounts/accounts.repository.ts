import type { Account, AccountType, Currency, OpeningBalance } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { idString, toObjectId, toObjectIdOrNull } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { AccountModel, type AccountDoc } from './accounts.model';

function toAccount(doc: AccountDoc): Account {
  return {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    currency: doc.currency,
    bankId: idString(doc.bankId ?? null),
    networkId: idString(doc.networkId ?? null),
    // Stored before balances existed means none was given.
    openingBalance: doc.openingBalance
      ? { amountCents: doc.openingBalance.amountCents, date: doc.openingBalance.date }
      : null,
    archived: doc.archived,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const accountsPort = createCollectionPort(AccountModel, [
  { field: 'bankId', to: COLLECTIONS.institutions },
  { field: 'networkId', to: COLLECTIONS.institutions },
]);

export const accountsRepository = {
  async findAll(): Promise<Account[]> {
    const docs = await AccountModel.find().sort({ archived: 1, nameKey: 1 }).lean<AccountDoc[]>();
    return docs.map(toAccount);
  },

  async findById(id: string): Promise<Account | null> {
    const doc = await AccountModel.findById(toObjectId(id)).lean<AccountDoc>();
    return doc ? toAccount(doc) : null;
  },

  async findByNameKey(nameKey: string): Promise<Account | null> {
    const doc = await AccountModel.findOne({ nameKey }).lean<AccountDoc>();
    return doc ? toAccount(doc) : null;
  },

  async create(
    data: {
      name: string;
      nameKey: string;
      type: AccountType;
      currency: Currency;
      bankId: string | null;
      networkId: string | null;
      openingBalance: OpeningBalance | null;
    },
    options: WriteOptions = {},
  ): Promise<Account> {
    const record = {
      ...data,
      bankId: toObjectIdOrNull(data.bankId),
      networkId: toObjectIdOrNull(data.networkId),
    };
    const [doc] = await AccountModel.create([record], { session: options.session });
    return toAccount(doc!.toObject() as AccountDoc);
  },

  async update(
    id: string,
    changes: Partial<{
      name: string;
      nameKey: string;
      archived: boolean;
      bankId: string | null;
      networkId: string | null;
      openingBalance: OpeningBalance | null;
    }>,
  ): Promise<Account | null> {
    const { bankId, networkId, ...rest } = changes;
    const set = {
      ...rest,
      ...(bankId !== undefined ? { bankId: toObjectIdOrNull(bankId) } : {}),
      ...(networkId !== undefined ? { networkId: toObjectIdOrNull(networkId) } : {}),
    };
    const doc = await AccountModel.findByIdAndUpdate(
      toObjectId(id),
      { $set: set },
      { new: true },
    ).lean<AccountDoc>();
    return doc ? toAccount(doc) : null;
  },

  /** Accounts tied to an institution, as bank or as card brand. */
  countByInstitution(institutionId: string): Promise<number> {
    const id = toObjectId(institutionId);
    return AccountModel.countDocuments({ $or: [{ bankId: id }, { networkId: id }] });
  },

  async delete(id: string): Promise<boolean> {
    const result = await AccountModel.deleteOne({ _id: toObjectId(id) });
    return result.deletedCount === 1;
  },
};

export type AccountsRepository = typeof accountsRepository;
