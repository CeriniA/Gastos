import { Router } from 'express';
import { createTagsController } from './tags.controller';
import type { TagsService } from './tags.service';

export function createTagsRouter(service: TagsService): Router {
  const controller = createTagsController(service);
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:id', controller.rename);
  router.delete('/:id', controller.remove);
  return router;
}
