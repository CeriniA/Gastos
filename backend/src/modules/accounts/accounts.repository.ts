import type { Account, AccountType, Currency } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { toObjectId } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { AccountModel, type AccountDoc } from './accounts.model';

function toAccount(doc: AccountDoc): Account {
  return {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    currency: doc.currency,
    archived: doc.archived,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const accountsPort = createCollectionPort(AccountModel);

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
    data: { name: string; nameKey: string; type: AccountType; currency: Currency },
    options: WriteOptions = {},
  ): Promise<Account> {
    const [doc] = await AccountModel.create([data], { session: options.session });
    return toAccount(doc!.toObject() as AccountDoc);
  },

  async update(
    id: string,
    changes: Partial<{ name: string; nameKey: string; archived: boolean }>,
  ): Promise<Account | null> {
    const doc = await AccountModel.findByIdAndUpdate(
      toObjectId(id),
      { $set: changes },
      { new: true },
    ).lean<AccountDoc>();
    return doc ? toAccount(doc) : null;
  },

  async delete(id: string): Promise<boolean> {
    const result = await AccountModel.deleteOne({ _id: toObjectId(id) });
    return result.deletedCount === 1;
  },
};

export type AccountsRepository = typeof accountsRepository;
