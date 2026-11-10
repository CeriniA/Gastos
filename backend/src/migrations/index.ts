import type { Migration } from '../core/db/migrations';
import { defaultInstitutions } from './2026-10-12-default-institutions';
import { documentText } from './2026-10-12-document-text';
import { transactionRefund } from './2026-10-12-transaction-refund';
import { dataOwners } from './2026-10-13-data-owners';
import { accountOpeningBalance } from './2026-10-17-account-opening-balance';
import { recurringMerchant } from './2026-10-17-recurring-merchant';
import { recurringNameIndex } from './2026-10-17-recurring-name-index';
import { userAiLimit } from './2026-10-17-user-ai-limit';
import { categoryRole } from './2026-11-10-category-role';

/**
 * Add migrations here in order. Example:
 *
 *   {
 *     id: '2026-11-01-example',
 *     async up() {
 *       // change stored documents here
 *     },
 *   },
 */
export const migrations: readonly Migration[] = [
  defaultInstitutions,
  documentText,
  transactionRefund,
  dataOwners,
  recurringMerchant,
  accountOpeningBalance,
  recurringNameIndex,
  userAiLimit,
  categoryRole,
];
