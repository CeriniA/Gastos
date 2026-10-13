import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APP_ID, BACKUP_FORMAT_VERSION, type BackupFile } from '@gastos/shared';
import { BackupStoreError, type BackupStore } from '../../providers/drive/googleDrive';
import { createDriveBackup } from './driveBackup';

/** The automatic copy to Drive, over a store that lives in memory. */

const backupFile: BackupFile = {
  app: APP_ID,
  formatVersion: BACKUP_FORMAT_VERSION,
  exportedAt: '2026-10-12T12:00:00.000Z',
  collections: { accounts: [] },
};

function setup(storedAt: string | null) {
  const clock = { now: new Date('2026-10-12T12:00:00.000Z') };
  const saved: string[] = [];
  const errors: unknown[] = [];
  const store = {
    savedAt: storedAt ? new Date(storedAt) : null,
    failure: null as Error | null,
    async lastSavedAt() {
      if (this.failure) throw this.failure;
      return this.savedAt;
    },
    async save(content: string) {
      if (this.failure) throw this.failure;
      saved.push(content);
      this.savedAt = clock.now;
    },
  } satisfies BackupStore & { savedAt: Date | null; failure: Error | null };
  const drive = createDriveBackup({
    store,
    exportAll: async () => backupFile,
    now: () => clock.now,
    onError: (error) => errors.push(error),
  });
  return { drive, store, saved, errors, clock };
}

test('the first copy is written at once, then at most once a day', async () => {
  const { drive, saved, clock } = setup(null);
  assert.deepEqual(await drive.runIfDue(), {
    configured: true,
    lastSavedAt: '2026-10-12T12:00:00.000Z',
    lastError: null,
  });
  assert.equal(saved.length, 1);
  assert.deepEqual(JSON.parse(saved[0]!), backupFile);

  clock.now = new Date('2026-10-13T11:00:00.000Z');
  await drive.runIfDue();
  assert.equal(saved.length, 1, 'less than a day later nothing is written');

  clock.now = new Date('2026-10-13T12:00:00.000Z');
  await drive.runIfDue();
  assert.equal(saved.length, 2);
});

test('asked by the user, the copy is written even if it is recent', async () => {
  const { drive, saved } = setup('2026-10-12T11:00:00.000Z');
  await drive.runIfDue();
  assert.equal(saved.length, 0);
  await drive.runNow();
  assert.equal(saved.length, 1);
});

test('two calls at the same time write once', async () => {
  const { drive, saved } = setup(null);
  await Promise.all([drive.runIfDue(), drive.runIfDue(), drive.runNow()]);
  assert.equal(saved.length, 1);
});

test('a failure is reported, not thrown, and the next success clears it', async () => {
  const { drive, store, errors } = setup(null);
  store.failure = new BackupStoreError('not_authorized', 'revoked');
  assert.equal((await drive.runNow()).lastError, 'not_authorized');
  store.failure = new Error('boom');
  assert.equal((await drive.runNow()).lastError, 'unavailable');
  assert.equal(errors.length, 2);
  store.failure = null;
  assert.equal((await drive.runNow()).lastError, null);
});

test('the status says when the copy in Drive was written, and that it is off without a store', async () => {
  const { drive } = setup('2026-10-10T08:00:00.000Z');
  assert.equal((await drive.status()).lastSavedAt, '2026-10-10T08:00:00.000Z');

  const off = createDriveBackup({
    store: null,
    exportAll: async () => backupFile,
    now: () => new Date(),
    onError: () => undefined,
  });
  assert.deepEqual(await off.runNow(), { configured: false, lastSavedAt: null, lastError: null });
  assert.deepEqual(await off.status(), { configured: false, lastSavedAt: null, lastError: null });
});
