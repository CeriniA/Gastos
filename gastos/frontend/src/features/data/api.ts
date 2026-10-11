import type {
  ExportFormat,
  ImportCommit,
  ImportPreview,
  ImportResult,
  IntegrityReport,
  RestoreResult,
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
  commitImport: (input: ImportCommit) =>
    api<ImportResult>('/spreadsheet/import/commit', { method: 'POST', body: input }),
};
