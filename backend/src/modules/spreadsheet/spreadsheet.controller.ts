import type { RequestHandler } from 'express';
import { exportQuerySchema, importCommitSchema } from '@gastos/shared';
import { ValidationError } from '../../core/errors/errors';
import { ok, parse, sendFile } from '../../core/http/http';
import type { SpreadsheetService } from './spreadsheet.service';

export function createSpreadsheetController(service: SpreadsheetService) {
  const exportTransactions: RequestHandler = async (req, res) => {
    sendFile(res, await service.exportTransactions(parse(exportQuerySchema, req.query)));
  };
  const template: RequestHandler = async (_req, res) => {
    sendFile(res, await service.template());
  };
  const preview: RequestHandler = async (req, res) => {
    if (!req.file) throw new ValidationError('Attach the spreadsheet in a field named "file"');
    ok(res, await service.preview({ content: req.file.buffer, fileName: req.file.originalname }));
  };
  const commit: RequestHandler = async (req, res) => {
    ok(res, await service.commit(parse(importCommitSchema, req.body)), 201);
  };
  return { exportTransactions, template, preview, commit };
}
