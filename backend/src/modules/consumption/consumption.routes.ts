import { Router } from 'express';
import { createConsumptionController } from './consumption.controller';
import type { ConsumptionService } from './consumption.service';

export function createConsumptionRouter(service: ConsumptionService): Router {
  const controller = createConsumptionController(service);
  const router = Router();
  router.get('/summary', controller.summary);
  router.get('/items', controller.search);
  return router;
}
