import express, { Router } from 'express';
import multer from 'multer';
import { MAX_DOCUMENT_FILES, MAX_UPLOAD_BYTES } from '@gastos/shared';
import { createDocumentsController } from './documents.controller';
import type { DocumentsService } from './documents.service';

export function createDocumentsRouter(service: DocumentsService): Router {
  const controller = createDocumentsController(service);
  // Images and PDFs are read from memory and never written to the server's disk.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_DOCUMENT_FILES },
  });

  const router = Router();
  router.get('/', controller.list);
  router.post('/', upload.array('files', MAX_DOCUMENT_FILES), controller.upload);
  // A statement's PDF is read in memory and dropped: only the text the user approves is stored.
  router.post('/statement/preview', upload.single('file'), controller.previewStatement);
  router.post('/statement', express.json({ limit: '1mb' }), controller.uploadStatement);
  router.get('/:id', controller.get);
  router.get('/:id/files/:index', controller.file);
  router.post('/:id/retry', controller.retry);
  router.post('/:id/confirm', express.json({ limit: '1mb' }), controller.confirm);
  router.delete('/:id', controller.remove);
  return router;
}
