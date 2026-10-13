import type { RequestHandler } from 'express';
import { APP_ID, DRIVE_RESULT_PARAM, type DriveConnectResult } from '@gastos/shared';
import { runAsUser } from '../../core/context/owner';
import { asUser, ok, sendFile } from '../../core/http/http';
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
  /** The address of Google's page; the screen sends the browser there. */
  const driveConnect: RequestHandler = (_req, res) => {
    ok(res, { url: drive.connectUrl() });
  };
  const driveDisconnect: RequestHandler = async (_req, res) => {
    ok(res, await drive.disconnect());
  };
  return asUser({ exportAll, restore, integrity, driveStatus, driveNow, driveConnect, driveDisconnect });
}

/**
 * Where Google sends the browser back after the user answered. There is no
 * session token here (it is a plain page load): who it is comes in the ticket
 * the server issued. It ends on the data screen, saying how it went.
 */
export function createDriveCallback(drive: DriveBackup, dataScreenUrl: string): RequestHandler {
  return async (req, res) => {
    const { code, state } = req.query;
    const userId = typeof state === 'string' ? drive.whoIsBack(state) : null;
    let result: DriveConnectResult = 'failed';
    if (userId && typeof code === 'string') {
      try {
        await runAsUser(userId, () => drive.connect(code));
        result = 'connected';
      } catch {
        // Said on the data screen; the detail is in what `drive` reported.
      }
    } else if (userId) {
      result = 'refused';
    }
    res.redirect(`${dataScreenUrl}?${DRIVE_RESULT_PARAM}=${result}`);
  };
}
