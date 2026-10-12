import express, { Router } from 'express';
import multer from 'multer';
import { MAX_DOCUMENT_FILES, MAX_UPLOAD_BYTES } from '@gastos/shared';
import { createDocumentsController } from './documents.controller';
import type { DocumentsService } from './documents.service';

export function createDocumentsRouter(service: DocumentsService): Router {
  const controller = createDocumentsController(service);
  // Images are read from memory and never written to the server's disk.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_DOCUMENT_FILES },
  });

  const router = Router();
  router.get('/', controller.list);
  router.post('/', upload.array('files', MAX_DOCUMENT_FILES), controller.upload);
  router.get('/:id', controller.get);
  router.get('/:id/files/:index', controller.file);
  router.post('/:id/retry', controller.retry);
  router.post('/:id/confirm', express.json({ limit: '1mb' }), controller.confirm);
  router.delete('/:id', controller.remove);
  return router;
}
