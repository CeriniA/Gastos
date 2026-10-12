import type { Migration } from '../core/db/migrations';
import { defaultInstitutions } from './2026-10-12-default-institutions';

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
export const migrations: readonly Migration[] = [defaultInstitutions];
