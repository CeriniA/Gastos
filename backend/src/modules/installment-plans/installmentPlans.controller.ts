import type { RequestHandler } from 'express';
import { idParamsSchema, installmentPlanCreateSchema } from '@gastos/shared';
import { ok, parse } from '../../core/http/http';
import type { InstallmentPlansService } from './installmentPlans.service';

export function createInstallmentPlansController(service: InstallmentPlansService) {
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(installmentPlanCreateSchema, req.body)), 201);
  };
  const remove: RequestHandler = async (req, res) => {
    ok(res, { trashed: await service.remove(parse(idParamsSchema, req.params).id) });
  };
  return { create, remove };
}
