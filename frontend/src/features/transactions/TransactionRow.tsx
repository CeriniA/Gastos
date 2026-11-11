import { Link } from 'react-router-dom';
import {
  DEFAULT_TIMEZONE,
  formatMoney,
  formatShortDate,
  todayIso,
  type Account,
  type Category,
  type Transaction,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { LookBadge, transactionLook } from '../../shared/ui/categoryLook';
import { useMerchants } from '../lists/api';

const SIGN = { income: '+', expense: '−', transfer: '' } as const;
/** Money in stands out in green; spending stays calm, in the text colour. */
const TONE = { income: 'text-income', expense: 'text-ink', transfer: 'text-muted' } as const;

/** What a row is called: what the user wrote, the merchant, where a transfer went, or the category. */
function transactionTitle(
  transaction: Pick<Transaction, 'description' | 'type'>,
  merchantName: string | undefined,
  destinationName: string,
  categoryName: string | undefined,
): string {
  if (transaction.description) return transaction.description;
  if (merchantName) return merchantName;
  if (transaction.type === 'transfer') return es.transactions.transferTo(destinationName);
  return categoryName ?? es.transactions.noDescription;
}

export function TransactionRow({
  transaction,
  accounts,
  categories,
}: {
  transaction: Transaction;
  accounts: readonly Account[];
  categories: readonly Category[];
}) {
  const accountName = (id: string | null) => accounts.find((account) => account.id === id)?.name ?? '';
  const category = categories.find((candidate) => candidate.id === transaction.categoryId);
  // The query is shared by every row, so the list is fetched once.
  const merchants = useMerchants();
  const merchantName = merchants.data?.find((merchant) => merchant.id === transaction.merchantId)?.name;

  const title = transactionTitle(transaction, merchantName, accountName(transaction.toAccountId), category?.name);

  // The category first: it is what tells movements apart, and it should not be the part cut off.
  const details = [
    transaction.type === 'transfer'
      ? null
      : (category?.name ?? es.transactions.noCategory),
    formatShortDate(transaction.date, todayIso(DEFAULT_TIMEZONE)),
    accountName(transaction.accountId),
    transaction.installment
      ? es.transactions.installment(transaction.installment.number, transaction.installment.total)
      : null,
    transaction.status === 'projected' ? es.installments.projected : null,
    transaction.refund ? es.transactions.refundTag : null,
  ].filter((part) => part && part !== title);

  return (
    <li>
      <Link to={`/movimientos/${transaction.id}`} className="flex items-center gap-3 px-3 py-2.5">
        <LookBadge look={transactionLook(transaction, categories)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-sm text-muted">{details.join(' · ')}</span>
        </span>
        <span
          className={`amount shrink-0 font-semibold ${transaction.refund ? TONE.income : TONE[transaction.type]}`}
        >
          {transaction.refund ? SIGN.income : SIGN[transaction.type]}
          {formatMoney(transaction.amountCents, transaction.currency)}
        </span>
      </Link>
    </li>
  );
}
