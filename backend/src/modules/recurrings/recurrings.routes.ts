import { Router } from 'express';
import { createRecurringsController } from './recurrings.controller';
import type { RecurringsService } from './recurrings.service';

export function createRecurringsRouter(service: RecurringsService): Router {
  const controller = createRecurringsController(service);
  const router = Router();
  router.get('/', controller.overview);
  router.post('/from-transaction', controller.fromTransaction);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
