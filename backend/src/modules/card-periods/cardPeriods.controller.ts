import type { RequestHandler } from 'express';
import {
  cardPeriodCreateSchema,
  cardPeriodListQuerySchema,
  cardPeriodUpdateSchema,
  idParamsSchema,
} from '@gastos/shared';
import { noContent, ok, parse } from '../../core/http/http';
import type { CardPeriodsService } from './cardPeriods.service';

export function createCardPeriodsController(service: CardPeriodsService) {
  const statement: RequestHandler = async (req, res) => {
    ok(res, await service.statement(parse(cardPeriodListQuerySchema, req.query).accountId));
  };
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(cardPeriodCreateSchema, req.body)), 201);
  };
  const update: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.update(id, parse(cardPeriodUpdateSchema, req.body)));
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  return { statement, create, update, remove };
}
