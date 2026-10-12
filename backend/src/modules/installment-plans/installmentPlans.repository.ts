import type { Currency, InstallmentPlan } from '@gastos/shared';
import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { toObjectId } from '../../core/db/ids';
import type { WriteOptions } from '../../core/db/transaction';
import { InstallmentPlanModel, type InstallmentPlanDoc } from './installmentPlans.model';

function toPlan(doc: InstallmentPlanDoc): InstallmentPlan {
  return {
    id: doc._id.toString(),
    accountId: doc.accountId.toString(),
    description: doc.description,
    purchaseDate: doc.purchaseDate,
    totalAmountCents: doc.totalAmountCents,
    currency: doc.currency,
    installments: doc.installments,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const installmentPlansPort = createCollectionPort(InstallmentPlanModel, [
  { field: 'accountId', to: COLLECTIONS.accounts },
]);

export const installmentPlansRepository = {
  async findById(id: string): Promise<InstallmentPlan | null> {
    const doc = await InstallmentPlanModel.findById(toObjectId(id)).lean<InstallmentPlanDoc>();
    return doc ? toPlan(doc) : null;
  },

  async create(
    data: {
      accountId: string;
      description: string;
      purchaseDate: string;
      totalAmountCents: number;
      currency: Currency;
      installments: number;
    },
    options: WriteOptions = {},
  ): Promise<InstallmentPlan> {
    const [doc] = await InstallmentPlanModel.create([{ ...data, accountId: toObjectId(data.accountId) }], {
      session: options.session,
    });
    return toPlan(doc!.toObject() as InstallmentPlanDoc);
  },

  countByAccount(accountId: string): Promise<number> {
    return InstallmentPlanModel.countDocuments({ accountId: toObjectId(accountId) });
  },
};

export type InstallmentPlansRepository = typeof installmentPlansRepository;
