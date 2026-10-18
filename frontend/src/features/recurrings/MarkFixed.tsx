import { Link } from 'react-router-dom';
import type { Transaction } from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { Button, Notice } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useRecurringMutations } from './api';

/** On a saved income or expense: mark it as fixed, or say that it already is. */
export function MarkFixed({ transaction }: { transaction: Transaction }) {
  const { fromTransaction } = useRecurringMutations();
  const { failure, run } = useAction();
  if (transaction.type === 'transfer') return null;

  if (transaction.recurringId) {
    return (
      <p className="text-sm text-muted">
        {es.recurrings.isFixed}{' '}
        <Link to="/mas/fijos" className="font-semibold text-primary">
          {es.recurrings.seeFixed}
        </Link>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {failure ? <Notice tone="error">{failure}</Notice> : null}
      <Button
        variant="secondary"
        className="w-full"
        disabled={fromTransaction.isPending}
        onClick={() =>
          void run(() => fromTransaction.mutateAsync({ transactionId: transaction.id, ignore: false }))
        }
      >
        {es.recurrings.mark}
      </Button>
      <p className="text-sm text-muted">{es.recurrings.markHint}</p>
    </div>
  );
}
