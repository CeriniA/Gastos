import { Schema, model } from 'mongoose';
import { DOCUMENT_KINDS, DOCUMENT_STATUSES, type DocumentKind, type DocumentStatus } from '@gastos/shared';
import { COLLECTIONS } from '../../core/db/collections';
import type { ObjectId } from '../../core/db/ids';

/** Stage 2: uploaded receipts, screenshots and statements waiting for the AI and the review screen. */
export interface DocumentDoc {
  _id: ObjectId;
  kind: DocumentKind;
  status: DocumentStatus;
  fileName: string;
  mimeType: string;
  /** SHA-256 of the uploaded file: the same file cannot be processed twice. */
  sha256: string;
  accountId: ObjectId | null;
  /** Compressed image, kept only until the document is confirmed or discarded. */
  image: Buffer | null;
  /** Validated ExtractionResult returned by the AI provider. */
  extraction: unknown;
  promptVersion: number | null;
  attempts: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<DocumentDoc>(
  {
    kind: { type: String, required: true, enum: [...DOCUMENT_KINDS] },
    status: { type: String, required: true, enum: [...DOCUMENT_STATUSES] },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sha256: { type: String, required: true, unique: true },
    accountId: { type: Schema.Types.ObjectId, default: null },
    image: { type: Buffer, default: null },
    extraction: { type: Schema.Types.Mixed, default: null },
    promptVersion: { type: Number, default: null },
    attempts: { type: Number, required: true, default: 0 },
    error: { type: String, default: null },
  },
  { timestamps: true },
);
schema.index({ status: 1, createdAt: 1 });

export const DocumentModel = model<DocumentDoc>('Document', schema, COLLECTIONS.documents);
