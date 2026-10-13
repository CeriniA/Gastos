import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_TIMEZONE,
  DRIVE_BACKUP_FILE_NAME,
  DRIVE_CONNECT_RESULTS,
  DRIVE_RESULT_PARAM,
  formatMoment,
  type DriveBackupStatus,
  type DriveConnectResult,
} from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Card, Notice } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useDriveBackup, useDriveBackupActions } from './api';

/**
 * How connecting ended, when the browser is just back from Google's page. It
 * is read once and taken out of the address, so reloading does not say it again.
 */
function useConnectResult(): DriveConnectResult | null {
  const [params, setParams] = useSearchParams();
  const [result] = useState(
    () => DRIVE_CONNECT_RESULTS.find((known) => known === params.get(DRIVE_RESULT_PARAM)) ?? null,
  );
  useEffect(() => {
    if (!params.has(DRIVE_RESULT_PARAM)) return;
    const rest = new URLSearchParams(params);
    rest.delete(DRIVE_RESULT_PARAM);
    setParams(rest, { replace: true });
  }, [params, setParams]);
  return result;
}

/**
 * The user's automatic copy of their backup to their own Google Drive:
 * connecting it, how it is doing, and a way to run it now.
 */
export function DriveBackupSection() {
  const status = useDriveBackup();
  const { copyNow, connect, disconnect } = useDriveBackupActions();
  const { failure, run } = useAction();
  const connectResult = useConnectResult();
  const busy = copyNow.isPending || connect.isPending || disconnect.isPending;

  const connected = (drive: DriveBackupStatus) => (
    <div className="space-y-3">
      <p className="text-sm">
        {drive.lastSavedAt
          ? es.data.drive.lastCopy(formatMoment(drive.lastSavedAt, DEFAULT_TIMEZONE))
          : es.data.drive.noCopy}
      </p>
      {drive.lastError ? <Notice tone="error">{es.data.drive.errors[drive.lastError]}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void run(copyNow.mutateAsync())}>
          {copyNow.isPending ? es.data.drive.copying : es.data.drive.copyNow}
        </Button>
        <Button
          variant="quiet"
          disabled={busy}
          onClick={() => {
            if (window.confirm(es.data.drive.disconnectConfirm)) void run(disconnect.mutateAsync());
          }}
        >
          {es.data.drive.disconnect}
        </Button>
      </div>
    </div>
  );

  const notConnected = (
    <div className="space-y-3">
      <p className="text-sm">{es.data.drive.notConnected}</p>
      <Button disabled={busy} onClick={() => void run(connect.mutateAsync())}>
        {connect.isPending ? es.data.drive.connecting : es.data.drive.connect}
      </Button>
    </div>
  );

  return (
    <Card>
      <h2 className="text-lg font-semibold">{es.data.drive.title}</h2>
      <p className="mb-3 mt-1 text-sm text-muted">{es.data.drive.text(DRIVE_BACKUP_FILE_NAME)}</p>
      <div className="space-y-3">
        {failure ? <Notice tone="error">{failure}</Notice> : null}
        <QueryState query={status}>
          {(drive) => {
            if (!drive.available) return <Notice>{es.data.drive.unavailable}</Notice>;
            // "Connected" stops being news the moment the user disconnects again.
            const news = connectResult === 'connected' && !drive.connected ? null : connectResult;
            return (
              <>
                {news ? (
                  <Notice tone={news === 'connected' ? 'success' : 'attention'}>
                    {es.data.drive.results[news]}
                  </Notice>
                ) : null}
                {drive.connected ? connected(drive) : notConnected}
              </>
            );
          }}
        </QueryState>
      </div>
    </Card>
  );
}
