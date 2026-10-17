import type { RequestHandler } from 'express';
import {
  idParamsSchema,
  recurringFromTransactionSchema,
  recurringOverviewQuerySchema,
  recurringUpdateSchema,
} from '@gastos/shared';
import { asUser, noContent, ok, parse } from '../../core/http/http';
import type { RecurringsService } from './recurrings.service';

export function createRecurringsController(service: RecurringsService) {
  const overview: RequestHandler = async (req, res) => {
    ok(res, await service.overview(parse(recurringOverviewQuerySchema, req.query).month));
  };
  const fromTransaction: RequestHandler = async (req, res) => {
    ok(res, await service.fromTransaction(parse(recurringFromTransactionSchema, req.body)), 201);
  };
  const update: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.update(id, parse(recurringUpdateSchema, req.body)));
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  return asUser({ overview, fromTransaction, update, remove });
}
