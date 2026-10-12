import { Router } from 'express';
import { createCategoryRulesController } from './categoryRules.controller';
import type { CategoryRulesService } from './categoryRules.service';

export function createCategoryRulesRouter(service: CategoryRulesService): Router {
  const controller = createCategoryRulesController(service);
  const router = Router();
  router.get('/', controller.list);
  // One rule per merchant: saving a rule for a known merchant replaces it.
  router.put('/', controller.save);
  router.delete('/:id', controller.remove);
  return router;
}
