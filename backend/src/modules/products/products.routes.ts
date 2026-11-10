import { Router } from 'express';
import { createProductsController } from './products.controller';
import type { ProductsService } from './products.service';

export function createProductsRouter(service: ProductsService): Router {
  const controller = createProductsController(service);
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  return router;
}
