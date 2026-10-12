import type { RequestHandler } from 'express';
import { consumptionSearchQuerySchema, consumptionSummaryQuerySchema } from '@gastos/shared';
import { ok, parse } from '../../core/http/http';
import type { ConsumptionService } from './consumption.service';

export function createConsumptionController(service: ConsumptionService) {
  const summary: RequestHandler = async (req, res) => {
    const { month } = parse(consumptionSummaryQuerySchema, req.query);
    ok(res, await service.summary(month));
  };
  const search: RequestHandler = async (req, res) => {
    ok(res, await service.search(parse(consumptionSearchQuerySchema, req.query)));
  };
  return { summary, search };
}
