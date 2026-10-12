import { Router } from 'express';
import { createExchangeRatesController } from './exchangeRates.controller';
import type { ExchangeRatesService } from './exchangeRates.service';

export function createExchangeRatesRouter(service: ExchangeRatesService): Router {
  const controller = createExchangeRatesController(service);
  const router = Router();
  router.get('/reference', controller.reference);
  return router;
}
