import type { RequestHandler } from 'express';
import { idParamsSchema, institutionCreateSchema, institutionUpdateSchema } from '@gastos/shared';
import { asUser, noContent, ok, parse } from '../../core/http/http';
import type { InstitutionsService } from './institutions.service';
import { HTTP_STATUS } from '../../core/http/status';

export function createInstitutionsController(service: InstitutionsService) {
  const list: RequestHandler = async (_req, res) => {
    ok(res, await service.list());
  };
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(institutionCreateSchema, req.body)), HTTP_STATUS.created);
  };
  const update: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.update(id, parse(institutionUpdateSchema, req.body)));
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  return asUser({ list, create, update, remove });
}
