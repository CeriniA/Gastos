import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DRIVE_BACKUP_STALE_HOURS,
  hoursBetween,
  type DriveBackupStatus,
  type ExportFormat,
  type ImportCommit,
  type ImportPreview,
  type ImportResult,
  type ImportReview,
  type IntegrityReport,
  type RestoreResult,
} from '@gastos/shared';
import { api, download } from '../../shared/api/client';

export const dataApi = {
  downloadBackup: () => download('/backup/export'),
  restoreBackup: (backup: unknown) => api<RestoreResult>('/backup/restore', { method: 'POST', body: backup }),
  checkIntegrity: () => api<IntegrityReport>('/backup/integrity'),

  exportTransactions: (format: ExportFormat) => download('/spreadsheet/export', { format }),
  downloadTemplate: () => download('/spreadsheet/template'),
  previewImport: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api<ImportPreview>('/spreadsheet/import/preview', { method: 'POST', formData });
  },
  /** Checks again rows the user adjusted after the preview. Writes nothing. */
  reviewImport: (input: ImportReview) =>
    api<ImportPreview>('/spreadsheet/import/review', { method: 'POST', body: input }),
  commitImport: (input: ImportCommit) =>
    api<ImportResult>('/spreadsheet/import/commit', { method: 'POST', body: input }),
};

const DRIVE_KEY = ['backup', 'drive'] as const;

/** The automatic copy to Google Drive: whether it is on, when it last ran, and why it failed. */
export function useDriveBackup() {
  return useQuery({
    queryKey: DRIVE_KEY,
    queryFn: () => api<DriveBackupStatus>('/backup/drive'),
  });
}

export function useDriveBackupNow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<DriveBackupStatus>('/backup/drive', { method: 'POST' }),
    onSuccess: (status) => client.setQueryData(DRIVE_KEY, status),
  });
}

/** The copy is on but failing, or has not run for too long while the app is in use. */
export function driveBackupNeedsAttention(status: DriveBackupStatus | undefined, now = new Date()): boolean {
  if (!status?.configured) return false;
  if (status.lastError) return true;
  return !status.lastSavedAt || hoursBetween(status.lastSavedAt, now) > DRIVE_BACKUP_STALE_HOURS;
}
