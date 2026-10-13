import type { RequestHandler } from 'express';
import { categoryRuleInputSchema, idParamsSchema } from '@gastos/shared';
import { asUser, noContent, ok, parse } from '../../core/http/http';
import type { CategoryRulesService } from './categoryRules.service';

export function createCategoryRulesController(service: CategoryRulesService) {
  const list: RequestHandler = async (_req, res) => {
    ok(res, await service.list());
  };
  const save: RequestHandler = async (req, res) => {
    ok(res, await service.save(parse(categoryRuleInputSchema, req.body)));
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  return asUser({ list, save, remove });
}
