import { Link } from 'react-router-dom';
import { formatDate, formatMoney, type Account, type Category, type Transaction } from '@gastos/shared';
import { es } from '../../shared/i18n/es';

const SIGN = { income: '+', expense: '−', transfer: '' } as const;
const TONE = { income: 'text-income', expense: 'text-expense', transfer: 'text-muted' } as const;

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

  const title =
    transaction.description ||
    (transaction.type === 'transfer'
      ? es.transactions.transferTo(accountName(transaction.toAccountId))
      : (category?.name ?? es.transactions.noDescription));

  const details = [
    formatDate(transaction.date),
    accountName(transaction.accountId),
    transaction.type === 'transfer'
      ? null
      : transaction.splits.length > 0
        ? es.transactions.split.summary(transaction.splits.length)
        : (category?.name ?? es.transactions.noCategory),
    transaction.installment
      ? es.transactions.installment(transaction.installment.number, transaction.installment.total)
      : null,
    transaction.status === 'projected' ? es.installments.projected : null,
    transaction.refund ? es.transactions.refundTag : null,
  ].filter((part) => part && part !== title);

  return (
    <li>
      <Link to={`/movimientos/${transaction.id}`} className="flex items-center justify-between gap-3 p-3">
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-sm text-muted">{details.join(', ')}</span>
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
