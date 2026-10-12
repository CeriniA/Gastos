import type { RequestHandler } from 'express';
import {
  idParamsSchema,
  lastRateQuerySchema,
  summaryQuerySchema,
  transactionCreateSchema,
  transactionListQuerySchema,
  transactionUpdateSchema,
} from '@gastos/shared';
import { noContent, ok, parse } from '../../core/http/http';
import type { TransactionsService } from './transactions.service';

export function createTransactionsController(service: TransactionsService) {
  const list: RequestHandler = async (req, res) => {
    ok(res, await service.list(parse(transactionListQuerySchema, req.query)));
  };
  const summary: RequestHandler = async (req, res) => {
    ok(res, await service.summary(parse(summaryQuerySchema, req.query).month));
  };
  const lastRate: RequestHandler = async (req, res) => {
    ok(res, await service.lastRate(parse(lastRateQuerySchema, req.query).currency));
  };
  const get: RequestHandler = async (req, res) => {
    ok(res, await service.get(parse(idParamsSchema, req.params).id));
  };
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(transactionCreateSchema, req.body)), 201);
  };
  const update: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.update(id, parse(transactionUpdateSchema, req.body)));
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  const restore: RequestHandler = async (req, res) => {
    ok(res, await service.restore(parse(idParamsSchema, req.params).id));
  };
  const removeForever: RequestHandler = async (req, res) => {
    await service.removeForever(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  const emptyTrash: RequestHandler = async (_req, res) => {
    ok(res, { deleted: await service.emptyTrash() });
  };
  return { list, summary, lastRate, get, create, update, remove, restore, removeForever, emptyTrash };
}
