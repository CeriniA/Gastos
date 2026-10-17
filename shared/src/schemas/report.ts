import { z } from 'zod';
import {
  DEFAULT_EVOLUTION_MONTHS,
  MAX_EVOLUTION_MONTHS,
  type CategoryKind,
  type Currency,
} from '../constants';
import type { IsoDate, MonthKey } from '../dates';
import { currencySchema, monthKeySchema } from './common';
import type { CurrencyTotals, Transaction } from './transaction';

/**
 * Reports. Like the monthly balance, every one counts each transaction in the
 * month it is paid, refunds take away, and transfers and the trash do not add
 * to income or expenses.
 *
 * Each report shows every currency apart. With `in` it shows everything in
 * that one currency, each transaction converted with the user's rate for its
 * day (see `Consolidation`).
 */
const consolidateSchema = { in: currencySchema.optional() };

export const categoryReportQuerySchema = z.object({ month: monthKeySchema, ...consolidateSchema });
export const monthReportQuerySchema = categoryReportQuerySchema;

export const evolutionQuerySchema = z.object({
  /** The last month shown. */
  to: monthKeySchema,
  months: z.coerce.number().int().min(1).max(MAX_EVOLUTION_MONTHS).default(DEFAULT_EVOLUTION_MONTHS),
  ...consolidateSchema,
});

export const projectionQuerySchema = z.object(consolidateSchema);

/**
 * Everything shown in one currency. A transaction on a day no rate covers is
 * left out rather than converted with an invented one, and counted here so the
 * screen can say so.
 */
export interface Consolidation {
  currency: Currency;
  /** Transactions (or expected items) left out because no rate covers their day. */
  leftOut: number;
}

/** One category with everything filed under it and under its subcategories. */
export interface CategoryAmount {
  /** Null gathers what has no category. */
  categoryId: string | null;
  name: string;
  /** Its own plus its subcategories': refunds already taken away. */
  totalCents: number;
  /** Subcategories with something in the month, largest first. */
  children: CategoryAmount[];
}

/** The income or the expenses of a month in one currency, by category. */
export interface KindReport {
  kind: CategoryKind;
  totalCents: number;
  /** Root categories with something in the month, largest first. */
  categories: CategoryAmount[];
}

export interface CurrencyCategoryReport {
  currency: string;
  income: KindReport;
  expense: KindReport;
}

export interface CategoryReport {
  month: string;
  /** One entry per currency: amounts in different currencies are never added together. */
  currencies: CurrencyCategoryReport[];
  /** Null when each currency is shown apart. */
  consolidated: Consolidation | null;
}

/** What one transaction, or one part of a divided one, adds to a category. */
export interface FiledAmount {
  transactionId: string;
  /** The day of the transaction: the rate of that day converts it. */
  date: IsoDate;
  kind: CategoryKind;
  currency: Currency;
  categoryId: string | null;
  /** Negative for a refund: it takes away from its category. */
  cents: number;
}

/**
 * What the reports read of a transaction. Confirmed ones are facts; projected
 * ones (installments to come) only enter the projection.
 */
export type ReportRow = Pick<
  Transaction,
  | 'id'
  | 'type'
  | 'refund'
  | 'status'
  | 'date'
  | 'paymentDate'
  | 'amountCents'
  | 'currency'
  | 'accountId'
  | 'toAccountId'
  | 'toAmountCents'
  | 'description'
  | 'recurringId'
  | 'installment'
>;

/** What went in and out of one account in a month, in its currency (or the one shown). */
export interface AccountActivity {
  accountId: string;
  name: string;
  currency: Currency;
  incomeCents: number;
  /** Refunds already taken away. */
  expenseCents: number;
  /** Transfers that reached it, and that left it: paying the card, buying dollars. */
  transfersInCents: number;
  transfersOutCents: number;
  /**
   * What the account had at the end of the month (today, for this month).
   * Null for a day before its opening balance: what it had then is not known.
   */
  closingBalanceCents: number | null;
}

export interface AccountReport {
  month: string;
  /** The day the closing balances are worked out for: the month's last day, or today. */
  balanceOn: IsoDate;
  /** Every account that is not archived, moved in the month or not, and the archived ones that moved; by name. */
  accounts: AccountActivity[];
  consolidated: Consolidation | null;
}

/** Income and expenses of each month, oldest first. */
export interface EvolutionReport {
  months: { month: MonthKey; totals: CurrencyTotals[] }[];
  consolidated: Consolidation | null;
}

/** A merchant as the report shows it: transactions with the same description, whatever its case or accents. */
export interface MerchantAmount {
  name: string;
  /** Refunds already taken away. */
  totalCents: number;
  /** Purchases in the month. */
  count: number;
}

export interface CurrencyMerchants {
  currency: Currency;
  /** Every expense of the month, with or without a description. */
  totalCents: number;
  /** The largest ones, largest first. */
  merchants: MerchantAmount[];
  /** Everything else: smaller merchants, and expenses without a description. */
  othersCents: number;
}

export interface MerchantReport {
  month: string;
  currencies: CurrencyMerchants[];
  consolidated: Consolidation | null;
}

/** Something expected in a month that has not happened yet: an installment to come, or a fixed item. */
export interface ProjectedEntry {
  kind: 'installment' | 'recurring';
  type: CategoryKind;
  name: string;
  installment: { number: number; total: number } | null;
  /** When it is paid: the installment's payment date, or the fixed item's usual day. */
  date: IsoDate;
  cents: number;
  currency: Currency;
}

/** A month to come in one currency: what is already certain plus what is expected. */
export interface ProjectedCurrency {
  currency: Currency;
  /** Already loaded and paid in the month (card purchases made before it, included). */
  confirmedIncomeCents: number;
  confirmedExpenseCents: number;
  /** Fixed income and expenses expected and not seen yet, and installments to come. */
  expectedIncomeCents: number;
  expectedExpenseCents: number;
  /** Both together: how the month would end. */
  balanceCents: number;
}

export interface ProjectedMonth {
  month: MonthKey;
  currencies: ProjectedCurrency[];
  /** What is expected, by date. */
  entries: ProjectedEntry[];
}

export interface ProjectionReport {
  /** This month and the next ones. */
  months: ProjectedMonth[];
  consolidated: Consolidation | null;
}
