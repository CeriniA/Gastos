import type { Migration } from '../core/db/migrations';
import { DocumentModel } from '../modules/documents/documents.model';

/** Documents stored before card statements existed get the new `text` field, empty. */
export const documentText: Migration = {
  id: '2026-10-12-document-text',
  async up() {
    await DocumentModel.updateMany({ text: { $exists: false } }, { $set: { text: null } });
  },
};
