import { Router } from 'express';
import { createAccountsController } from './accounts.controller';
import type { AccountsService } from './accounts.service';

export function createAccountsRouter(service: AccountsService): Router {
  const controller = createAccountsController(service);
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
