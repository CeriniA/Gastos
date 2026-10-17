import { Router } from 'express';
import { createExchangeRatesController } from './exchangeRates.controller';
import type { ExchangeRatesService } from './exchangeRates.service';

export function createExchangeRatesRouter(service: ExchangeRatesService): Router {
  const controller = createExchangeRatesController(service);
  const router = Router();
  router.get('/reference', controller.reference);
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
