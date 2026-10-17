import { Router } from 'express';
import { createReportsController } from './reports.controller';
import type { ReportsService } from './reports.service';

export function createReportsRouter(service: ReportsService): Router {
  const controller = createReportsController(service);
  const router = Router();
  router.get('/categories', controller.byCategory);
  router.get('/accounts', controller.byAccount);
  router.get('/merchants', controller.byMerchant);
  router.get('/evolution', controller.evolution);
  router.get('/projection', controller.projection);
  return router;
}
