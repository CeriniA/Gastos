import { Router } from 'express';
import { createProductRulesController } from './productRules.controller';
import type { ProductRulesService } from './productRules.service';

/** Rules are created from the review of a receipt; here they are listed and forgotten. */
export function createProductRulesRouter(service: ProductRulesService): Router {
  const controller = createProductRulesController(service);
  const router = Router();
  router.get('/', controller.list);
  router.delete('/:id', controller.remove);
  return router;
}
