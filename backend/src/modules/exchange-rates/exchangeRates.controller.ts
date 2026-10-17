import type { RequestHandler } from 'express';
import { exchangeRateInputSchema, idParamsSchema, referenceRateQuerySchema } from '@gastos/shared';
import { asUser, noContent, ok, parse } from '../../core/http/http';
import type { ExchangeRatesService } from './exchangeRates.service';

export function createExchangeRatesController(service: ExchangeRatesService) {
  const reference: RequestHandler = async (req, res) => {
    const { from, to } = parse(referenceRateQuerySchema, req.query);
    ok(res, await service.reference(from, to));
  };
  const list: RequestHandler = async (_req, res) => {
    ok(res, await service.list());
  };
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(exchangeRateInputSchema, req.body)), 201);
  };
  const update: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.update(id, parse(exchangeRateInputSchema, req.body)));
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  return asUser({ reference, list, create, update, remove });
}
