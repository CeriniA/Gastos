import { Router } from 'express';
import { createReportsController } from './reports.controller';
import type { ReportsService } from './reports.service';

export function createReportsRouter(service: ReportsService): Router {
  const controller = createReportsController(service);
  const router = Router();
  router.get('/categories', controller.byCategory);
  return router;
}
