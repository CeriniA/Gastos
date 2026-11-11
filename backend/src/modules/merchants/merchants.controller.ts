import type { RequestHandler } from 'express';
import { idParamsSchema, mergeSchema, merchantCreateSchema, merchantUpdateSchema } from '@gastos/shared';
import { asUser, ok, parse } from '../../core/http/http';
import { HTTP_STATUS } from '../../core/http/status';
import type { MerchantsService } from './merchants.service';

export function createMerchantsController(service: MerchantsService) {
  const list: RequestHandler = async (_req, res) => {
    ok(res, await service.list());
  };
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(merchantCreateSchema, req.body)), HTTP_STATUS.created);
  };
  const update: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.update(id, parse(merchantUpdateSchema, req.body)));
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    res.status(HTTP_STATUS.noContent).end();
  };
  const merge: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.merge(id, parse(mergeSchema, req.body).targetId));
  };
  return asUser({ list, create, update, remove, merge });
}
