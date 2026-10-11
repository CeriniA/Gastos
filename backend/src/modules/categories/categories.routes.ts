import { Router } from 'express';
import { createCategoriesController } from './categories.controller';
import type { CategoriesService } from './categories.service';

export function createCategoriesRouter(service: CategoriesService): Router {
  const controller = createCategoriesController(service);
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  router.post('/:id/merge', controller.merge);
  return router;
}
