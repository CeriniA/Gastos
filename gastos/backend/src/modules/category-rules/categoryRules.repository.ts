import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { CategoryRuleModel } from './categoryRules.model';

/**
 * Only the backup and integrity port exists so far. The repository, service,
 * controller and routes of this module are written in its stage (docs/ROADMAP.md).
 */
export const categoryRulesPort = createCollectionPort(CategoryRuleModel, [
  { field: 'categoryId', to: COLLECTIONS.categories },
]);
