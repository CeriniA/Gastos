import {
  DEFAULT_TIMEZONE,
  formatDate,
  formatMoney,
  todayIso,
  type Account,
  type ExtractedStatement,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { Button, Card, Notice } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useAccountBalance, useAccountMutations } from '../accounts/api';

/**
 * An account's statement says what the account had at its end. The app adds
 * up the same account (what it already has, plus what is ticked here) and
 * shows whether both agree: a difference means a movement is missing or
 * counted twice.
 */
export function BalanceCheck({
  account,
  statement,
  tickedCents,
}: {
  account: Account | undefined;
  statement: ExtractedStatement;
  /** What the ticked movements add to this account. */
  tickedCents: number;
}) {
  const on = statement.toDate ?? todayIso(DEFAULT_TIMEZONE);
  const balance = useAccountBalance(account?.id ?? null, on);
  const { update } = useAccountMutations();
  const { failure, run } = useAction();
  const closing = statement.closingBalanceCents ?? null;
  const opening = statement.openingBalanceCents ?? null;

  if (!account) return <Notice>{es.documents.balance.chooseAccount}</Notice>;
  if (closing === null) return null;

  const inApp = balance.data ? balance.data.balanceCents + tickedCents : null;
  const difference = inApp === null ? null : closing - inApp;
  const money = (cents: number) => formatMoney(cents, account.currency);
  // Without an opening balance the app counts from zero: the statement's own start is the best one.
  const start =
    account.openingBalance === null && opening !== null && statement.fromDate
      ? { amountCents: opening, date: statement.fromDate }
      : null;

  return (
    <Card>
      <h2 className="text-lg font-semibold">{es.documents.balance.title}</h2>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">{es.documents.balance.statement(formatDate(on))}</dt>
          <dd className="amount font-semibold">{money(closing)}</dd>
        </div>
        {inApp === null ? null : (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{es.documents.balance.inApp(account.name)}</dt>
            <dd className="amount font-semibold">{money(inApp)}</dd>
          </div>
        )}
      </dl>
      {difference === null ? null : (
        <div className="mt-3">
          {difference === 0 ? (
            <Notice tone="success">{es.documents.balance.matches}</Notice>
          ) : (
            <Notice tone="attention">{es.documents.balance.differs(money(difference))}</Notice>
          )}
        </div>
      )}
      {start && difference !== 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted">{es.documents.balance.noOpening(account.name)}</p>
          <Button
            variant="secondary"
            className="w-full"
            disabled={update.isPending}
            onClick={() =>
              void run(() =>
                update.mutateAsync({
                  id: account.id,
                  changes: { openingBalance: start },
                }),
              )
            }
          >
            {es.documents.balance.useOpening(money(start.amountCents), formatDate(start.date))}
          </Button>
        </div>
      ) : null}
      {failure ? (
        <div className="mt-3">
          <Notice tone="error">{failure}</Notice>
        </div>
      ) : null}
    </Card>
  );
}
