import type { RequestHandler } from 'express';
import { APP_ID } from '@gastos/shared';
import { ok, sendFile } from '../../core/http/http';
import type { BackupService } from './backup.service';
import type { DriveBackup } from './driveBackup';

export function createBackupController(service: BackupService, drive: DriveBackup) {
  const exportAll: RequestHandler = async (_req, res) => {
    const backup = await service.exportAll();
    sendFile(res, {
      fileName: `${APP_ID}-backup-${backup.exportedAt.slice(0, 10)}.json`,
      contentType: 'application/json; charset=utf-8',
      content: Buffer.from(JSON.stringify(backup), 'utf8'),
    });
  };
  const restore: RequestHandler = async (req, res) => {
    ok(res, await service.restore(req.body));
  };
  const integrity: RequestHandler = async (_req, res) => {
    ok(res, await service.integrity());
  };
  const driveStatus: RequestHandler = async (_req, res) => {
    ok(res, await drive.status());
  };
  const driveNow: RequestHandler = async (_req, res) => {
    ok(res, await drive.runNow());
  };
  return { exportAll, restore, integrity, driveStatus, driveNow };
}
