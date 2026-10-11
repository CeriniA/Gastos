import express, { Router } from 'express';
import multer from 'multer';
import { MAX_UPLOAD_BYTES } from '@gastos/shared';
import { createSpreadsheetController } from './spreadsheet.controller';
import type { SpreadsheetService } from './spreadsheet.service';

export function createSpreadsheetRouter(service: SpreadsheetService): Router {
  const controller = createSpreadsheetController(service);
  // Files are read from memory and never written to disk.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  });

  const router = Router();
  router.get('/export', controller.exportTransactions);
  router.get('/template', controller.template);
  router.post('/import/preview', upload.single('file'), controller.preview);
  router.post('/import/commit', express.json({ limit: '5mb' }), controller.commit);
  return router;
}
