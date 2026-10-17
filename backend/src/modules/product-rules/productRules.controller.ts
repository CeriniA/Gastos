import type { RequestHandler } from 'express';
import { idParamsSchema } from '@gastos/shared';
import { asUser, noContent, ok, parse } from '../../core/http/http';
import type { ProductRulesService } from './productRules.service';

export function createProductRulesController(service: ProductRulesService) {
  const list: RequestHandler = async (_req, res) => {
    ok(res, await service.list());
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  return asUser({ list, remove });
}
