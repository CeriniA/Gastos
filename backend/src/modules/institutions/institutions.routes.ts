import { Router } from 'express';
import { createInstitutionsController } from './institutions.controller';
import type { InstitutionsService } from './institutions.service';

export function createInstitutionsRouter(service: InstitutionsService): Router {
  const controller = createInstitutionsController(service);
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
