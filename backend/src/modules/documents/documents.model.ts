import { Schema, model } from 'mongoose';
import {
  DOCUMENT_ERROR_CODES,
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
  type DocumentErrorCode,
  type DocumentKind,
  type DocumentStatus,
} from '@gastos/shared';
import { COLLECTIONS } from '../../core/db/collections';
import type { ObjectId } from '../../core/db/ids';

/** Uploaded receipts and screenshots, from upload until the user confirms what was read. */
export interface DocumentDoc {
  _id: ObjectId;
  kind: DocumentKind;
  status: DocumentStatus;
  fileName: string;
  /** SHA-256 of the uploaded files: the same upload cannot be processed twice. */
  sha256: string;
  accountId: ObjectId | null;
  /**
   * The images, kept only while the document waits for the AI or for review.
   * Emptied the moment the user confirms.
   */
  files: { mimeType: string; data: Buffer }[];
  /** ReviewExtraction: what the AI read, after the user's rules were applied. */
  extraction: unknown;
  promptVersion: number | null;
  attempts: number;
  /** When a document waiting for the AI to have room again is tried next. */
  retryAt: Date | null;
  /** Automatic retries so far. */
  waits: number;
  errorCode: DocumentErrorCode | null;
  /** Technical detail of the last failure, for the logs. Never shown to the user. */
  errorDetail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<DocumentDoc>(
  {
    kind: { type: String, required: true, enum: [...DOCUMENT_KINDS] },
    status: { type: String, required: true, enum: [...DOCUMENT_STATUSES] },
    fileName: { type: String, required: true },
    sha256: { type: String, required: true, unique: true },
    accountId: { type: Schema.Types.ObjectId, default: null },
    files: {
      type: [
        new Schema(
          { mimeType: { type: String, required: true }, data: { type: Buffer, required: true } },
          { _id: false },
        ),
      ],
      default: [],
    },
    extraction: { type: Schema.Types.Mixed, default: null },
    promptVersion: { type: Number, default: null },
    attempts: { type: Number, required: true, default: 0 },
    retryAt: { type: Date, default: null },
    waits: { type: Number, required: true, default: 0 },
    errorCode: { type: String, enum: [...DOCUMENT_ERROR_CODES], default: null },
    errorDetail: { type: String, default: null },
  },
  { timestamps: true },
);
schema.index({ status: 1, createdAt: 1 });

export const DocumentModel = model<DocumentDoc>('Document', schema, COLLECTIONS.documents);
