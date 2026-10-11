import { useState } from 'react';
import { DEFAULT_TIMEZONE, addMonthsToKey, formatMonth, monthKeyOf, todayIso } from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, PageTitle } from '../../shared/ui/ui';
import { useAccounts } from '../accounts/api';
import { useCategories } from '../categories/api';
import { TransactionRow } from './TransactionRow';
import { useTransactions } from './api';

export function TransactionsPage() {
  const [month, setMonth] = useState(() => monthKeyOf(todayIso(DEFAULT_TIMEZONE)));
  const transactions = useTransactions({ month, pageSize: 200 });
  const accounts = useAccounts();
  const categories = useCategories();

  return (
    <>
      <PageTitle>{es.transactions.title}</PageTitle>

      <div className="mb-4 flex items-center justify-between rounded-lg border border-line bg-surface">
        <Button
          variant="quiet"
          aria-label={es.transactions.previousMonth}
          onClick={() => setMonth(addMonthsToKey(month, -1))}
        >
          ‹
        </Button>
        <p className="font-semibold first-letter:uppercase">{formatMonth(month)}</p>
        <Button
          variant="quiet"
          aria-label={es.transactions.nextMonth}
          onClick={() => setMonth(addMonthsToKey(month, 1))}
        >
          ›
        </Button>
      </div>

      <QueryState query={{ ...transactions, data: transactions.data?.items }} empty={es.transactions.empty}>
        {(items) => (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                accounts={accounts.data ?? []}
                categories={categories.data ?? []}
              />
            ))}
          </ul>
        )}
      </QueryState>
    </>
  );
}
