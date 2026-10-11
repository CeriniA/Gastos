import { createCollectionPort } from '../../core/db/collectionPort';
import { COLLECTIONS } from '../../core/db/collections';
import { CardPeriodModel } from './cardPeriods.model';

/**
 * Only the backup and integrity port exists so far. The repository, service,
 * controller and routes of this module are written in its stage (docs/ROADMAP.md).
 */
export const cardPeriodsPort = createCollectionPort(CardPeriodModel, [
  { field: 'accountId', to: COLLECTIONS.accounts },
  { field: 'documentId', to: COLLECTIONS.documents },
]);
