import type { RequestHandler } from 'express';
import {
  documentConfirmSchema,
  documentDeleteQuerySchema,
  documentFileParamsSchema,
  documentListQuerySchema,
  documentUploadSchema,
  idParamsSchema,
} from '@gastos/shared';
import { noContent, ok, parse } from '../../core/http/http';
import type { DocumentsService } from './documents.service';

export function createDocumentsController(service: DocumentsService) {
  const list: RequestHandler = async (req, res) => {
    ok(res, await service.list(parse(documentListQuerySchema, req.query).status));
  };
  const upload: RequestHandler = async (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];
    const created = await service.upload(
      parse(documentUploadSchema, req.body),
      files.map((file) => ({ originalName: file.originalname, content: file.buffer })),
    );
    ok(res, created, 202);
  };
  const get: RequestHandler = async (req, res) => {
    ok(res, await service.get(parse(idParamsSchema, req.params).id));
  };
  const file: RequestHandler = async (req, res) => {
    const { id, index } = parse(documentFileParamsSchema, req.params);
    const stored = await service.getFile(id, index);
    res.setHeader('Content-Type', stored.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(stored.content);
  };
  const retry: RequestHandler = async (req, res) => {
    ok(res, await service.retry(parse(idParamsSchema, req.params).id), 202);
  };
  const confirm: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.confirm(id, parse(documentConfirmSchema, req.body)), 201);
  };
  const remove: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    await service.remove(id, parse(documentDeleteQuerySchema, req.query).transactions);
    noContent(res);
  };
  return { list, upload, get, file, retry, confirm, remove };
}
