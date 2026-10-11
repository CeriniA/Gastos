import { createCollectionPort } from '../../core/db/collectionPort';
import { ExchangeRateModel } from './exchangeRates.model';

/**
 * Only the backup and integrity port exists so far. The repository, service,
 * controller and routes of this module are written in its stage (docs/ROADMAP.md).
 */
export const exchangeRatesPort = createCollectionPort(ExchangeRateModel, []);
