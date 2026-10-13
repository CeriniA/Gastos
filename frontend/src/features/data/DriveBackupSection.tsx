import { DEFAULT_TIMEZONE, DRIVE_BACKUP_FILE_NAME, formatMoment } from '@gastos/shared';
import { es } from '../../shared/i18n/es';
import { QueryState } from '../../shared/ui/QueryState';
import { Button, Card, Notice } from '../../shared/ui/ui';
import { useAction } from '../../shared/ui/useAction';
import { useDriveBackup, useDriveBackupNow } from './api';

/** The automatic copy of the backup to Google Drive: how it is doing, and a way to run it now. */
export function DriveBackupSection() {
  const status = useDriveBackup();
  const copyNow = useDriveBackupNow();
  const { failure, run } = useAction();

  return (
    <Card>
      <h2 className="text-lg font-semibold">{es.data.drive.title}</h2>
      <p className="mb-3 mt-1 text-sm text-muted">{es.data.drive.text(DRIVE_BACKUP_FILE_NAME)}</p>
      <QueryState query={status}>
        {(drive) =>
          drive.configured ? (
            <div className="space-y-3">
              <p className="text-sm">
                {drive.lastSavedAt
                  ? es.data.drive.lastCopy(formatMoment(drive.lastSavedAt, DEFAULT_TIMEZONE))
                  : es.data.drive.noCopy}
              </p>
              {drive.lastError ? <Notice tone="error">{es.data.drive.errors[drive.lastError]}</Notice> : null}
              {failure ? <Notice tone="error">{failure}</Notice> : null}
              <Button
                variant="secondary"
                disabled={copyNow.isPending}
                onClick={() => void run(copyNow.mutateAsync())}
              >
                {copyNow.isPending ? es.data.drive.copying : es.data.drive.copyNow}
              </Button>
            </div>
          ) : (
            <Notice>{es.data.drive.off}</Notice>
          )
        }
      </QueryState>
    </Card>
  );
}
