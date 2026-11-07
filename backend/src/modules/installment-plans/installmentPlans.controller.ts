import type { RequestHandler } from 'express';
import { idParamsSchema, installmentPlanCreateSchema } from '@gastos/shared';
import { asUser, ok, parse } from '../../core/http/http';
import type { InstallmentPlansService } from './installmentPlans.service';
import { HTTP_STATUS } from '../../core/http/status';

export function createInstallmentPlansController(service: InstallmentPlansService) {
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(installmentPlanCreateSchema, req.body)), HTTP_STATUS.created);
  };
  const remove: RequestHandler = async (req, res) => {
    ok(res, { trashed: await service.remove(parse(idParamsSchema, req.params).id) });
  };
  return asUser({ create, remove });
}
