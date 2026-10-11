import express, { Router } from 'express';
import { createBackupController } from './backup.controller';
import type { BackupService } from './backup.service';

export function createBackupRouter(service: BackupService): Router {
  const controller = createBackupController(service);
  const router = Router();
  router.get('/export', controller.exportAll);
  // A backup is far larger than a normal request, so this route has its own limit.
  router.post('/restore', express.json({ limit: '25mb' }), controller.restore);
  router.get('/integrity', controller.integrity);
  return router;
}
