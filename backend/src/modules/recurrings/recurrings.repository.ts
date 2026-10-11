import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { RecurringModel } from './recurrings.model';

/**
 * Only the backup and integrity port exists so far. The repository, service,
 * controller and routes of this module are written in its stage (docs/ROADMAP.md).
 */
export const recurringsPort = createCollectionPort(RecurringModel, [
  { field: 'accountId', to: COLLECTIONS.accounts },
  { field: 'categoryId', to: COLLECTIONS.categories },
]);
