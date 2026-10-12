import type { RequestHandler } from 'express';
import { idParamsSchema, institutionCreateSchema, institutionUpdateSchema } from '@gastos/shared';
import { noContent, ok, parse } from '../../core/http/http';
import type { InstitutionsService } from './institutions.service';

export function createInstitutionsController(service: InstitutionsService) {
  const list: RequestHandler = async (_req, res) => {
    ok(res, await service.list());
  };
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(institutionCreateSchema, req.body)), 201);
  };
  const update: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.update(id, parse(institutionUpdateSchema, req.body)));
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  return { list, create, update, remove };
}
