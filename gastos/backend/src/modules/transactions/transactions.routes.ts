import { Router } from 'express';
import { createTransactionsController } from './transactions.controller';
import type { TransactionsService } from './transactions.service';

export function createTransactionsRouter(service: TransactionsService): Router {
  const controller = createTransactionsController(service);
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/summary', controller.summary);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  router.post('/:id/restore', controller.restore);
  return router;
}
