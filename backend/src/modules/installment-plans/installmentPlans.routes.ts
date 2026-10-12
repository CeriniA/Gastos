import { Router } from 'express';
import { createInstallmentPlansController } from './installmentPlans.controller';
import type { InstallmentPlansService } from './installmentPlans.service';

export function createInstallmentPlansRouter(service: InstallmentPlansService): Router {
  const controller = createInstallmentPlansController(service);
  const router = Router();
  router.post('/', controller.create);
  router.delete('/:id', controller.remove);
  return router;
}
