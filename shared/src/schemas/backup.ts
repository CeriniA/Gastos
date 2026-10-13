import { z } from 'zod';
import { APP_ID, type DriveBackupError } from '../constants';

/**
 * Full backup: an exact copy of every collection, meant only for restoring.
 * Documents are encoded as canonical Extended JSON so ids and dates survive
 * the round trip unchanged.
 */
export const backupFileSchema = z.object({
  app: z.literal(APP_ID),
  formatVersion: z.number().int().positive(),
  exportedAt: z.string(),
  collections: z.record(z.string(), z.array(z.unknown())),
});
export type BackupFile = z.infer<typeof backupFileSchema>;

export interface RestoreResult {
  restored: Record<string, number>;
}

export interface BrokenReference {
  collection: string;
  documentId: string;
  field: string;
  missingId: string;
  references: string;
}

export interface IntegrityReport {
  ok: boolean;
  checkedAt: string;
  broken: BrokenReference[];
}

/** The user's automatic copy to their Google Drive, as the data screen shows it. */
export interface DriveBackupStatus {
  /** False when the server has no Google credentials: nobody can connect a Drive. */
  available: boolean;
  /** True once this user gave the app permission to write in their Drive. */
  connected: boolean;
  /** When the copy in Drive was last written, or null if there is none yet. */
  lastSavedAt: string | null;
  /** Why the last attempt since the server woke up failed, if it did. */
  lastError: DriveBackupError | null;
}
