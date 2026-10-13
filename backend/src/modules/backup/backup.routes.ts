import express, { Router } from 'express';
import { createBackupController } from './backup.controller';
import type { BackupService } from './backup.service';
import type { DriveBackup } from './driveBackup';

export function createBackupRouter(service: BackupService, drive: DriveBackup): Router {
  const controller = createBackupController(service, drive);
  const router = Router();
  router.get('/export', controller.exportAll);
  // A backup is far larger than a normal request, so this route has its own limit.
  router.post('/restore', express.json({ limit: '25mb' }), controller.restore);
  router.get('/integrity', controller.integrity);
  router.get('/drive', controller.driveStatus);
  router.post('/drive', controller.driveNow);
  return router;
}
