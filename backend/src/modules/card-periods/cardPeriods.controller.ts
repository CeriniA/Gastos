import type { RequestHandler } from 'express';
import {
  cardPaymentSchema,
  cardPeriodCreateSchema,
  cardPeriodListQuerySchema,
  cardPeriodUpdateSchema,
  idParamsSchema,
} from '@gastos/shared';
import { asUser, noContent, ok, parse } from '../../core/http/http';
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
  const pay: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.pay(id, parse(cardPaymentSchema, req.body)), 201);
  };
  return asUser({ statement, create, update, remove, pay });
}
