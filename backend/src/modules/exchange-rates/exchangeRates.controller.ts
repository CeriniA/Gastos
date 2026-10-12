import type { RequestHandler } from 'express';
import { referenceRateQuerySchema } from '@gastos/shared';
import { ok, parse } from '../../core/http/http';
import type { ExchangeRatesService } from './exchangeRates.service';

export function createExchangeRatesController(service: ExchangeRatesService) {
  const reference: RequestHandler = async (req, res) => {
    const { from, to } = parse(referenceRateQuerySchema, req.query);
    ok(res, await service.reference(from, to));
  };
  return { reference };
}
