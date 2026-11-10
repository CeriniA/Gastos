import { Router } from 'express';
import { createMerchantsController } from './merchants.controller';
import type { MerchantsService } from './merchants.service';

export function createMerchantsRouter(service: MerchantsService): Router {
  const controller = createMerchantsController(service);
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  return router;
}
