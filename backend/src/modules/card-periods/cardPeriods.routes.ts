import { Router } from 'express';
import { createCardPeriodsController } from './cardPeriods.controller';
import type { CardPeriodsService } from './cardPeriods.service';

export function createCardPeriodsRouter(service: CardPeriodsService): Router {
  const controller = createCardPeriodsController(service);
  const router = Router();
  router.get('/', controller.statement);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  router.post('/:id/payments', controller.pay);
  return router;
}
