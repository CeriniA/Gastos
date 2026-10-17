import type { RequestHandler } from 'express';
import {
  accountBalancesQuerySchema,
  accountCreateSchema,
  accountUpdateSchema,
  idParamsSchema,
} from '@gastos/shared';
import { asUser, noContent, ok, parse } from '../../core/http/http';
import type { AccountsService } from './accounts.service';

export function createAccountsController(service: AccountsService) {
  const list: RequestHandler = async (_req, res) => {
    ok(res, await service.list());
  };
  const get: RequestHandler = async (req, res) => {
    ok(res, await service.get(parse(idParamsSchema, req.params).id));
  };
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(accountCreateSchema, req.body)), 201);
  };
  const update: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.update(id, parse(accountUpdateSchema, req.body)));
  };
  const balances: RequestHandler = async (req, res) => {
    ok(res, await service.balances(parse(accountBalancesQuerySchema, req.query).on));
  };
  const balance: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.balance(id, parse(accountBalancesQuerySchema, req.query).on));
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  return asUser({ list, get, create, update, balances, balance, remove });
}
