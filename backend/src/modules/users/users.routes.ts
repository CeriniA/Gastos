import { Router } from 'express';
import { requireAdmin } from '../../core/middleware/auth';
import { createUsersController } from './users.controller';
import type { UsersService } from './users.service';

export function createUsersRouter(service: UsersService): Router {
  const controller = createUsersController(service);
  const router = Router();
  router.post('/me/password', controller.changePassword);
  // Everything else is the admin's.
  router.get('/', requireAdmin, controller.list);
  router.post('/', requireAdmin, controller.create);
  router.patch('/:id', requireAdmin, controller.update);
  return router;
}
