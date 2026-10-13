import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APP_ID, BACKUP_FORMAT_VERSION, type BackupFile } from '@gastos/shared';
import { codeOf } from '../../testing/assertions';
import { BackupStoreError, type BackupStore } from '../../providers/drive/googleDrive';
import { createDriveBackup } from './driveBackup';

/** Each user's automatic copy to their Drive, over a pretend Google that lives in memory. */

const backupOf = (owner: string): BackupFile => ({
  app: APP_ID,
  formatVersion: BACKUP_FORMAT_VERSION,
  exportedAt: '2026-10-12T12:00:00.000Z',
  collections: { accounts: [{ owner }] },
});

/** One user's Drive: what was saved in it and when. */
interface FakeDrive {
  saved: string[];
  savedAt: Date | null;
  failure: Error | null;
}

function setup(options: { available?: boolean } = {}) {
  const clock = { now: new Date('2026-10-12T12:00:00.000Z') };
  const errors: unknown[] = [];
  /** Who the code is running for, and what each user has stored as their permission. */
  const session = { user: 'ana' };
  const permissions = new Map<string, string>();
  const drives = new Map<string, FakeDrive>();
  const driveOf = (permission: string): FakeDrive => {
    const drive = drives.get(permission) ?? { saved: [], savedAt: null, failure: null };
    drives.set(permission, drive);
    return drive;
  };
  const open = (permission: string): BackupStore => ({
    async lastSavedAt() {
      const mine = driveOf(permission);
      if (mine.failure) throw mine.failure;
      return mine.savedAt;
    },
    async save(content) {
      const mine = driveOf(permission);
      if (mine.failure) throw mine.failure;
      mine.saved.push(content);
      mine.savedAt = clock.now;
    },
  });

  const drive = createDriveBackup({
    provider:
      options.available === false
        ? null
        : {
            consentUrl: (ticket) => `https://google.test/consent?state=${ticket}`,
            redeem: async (code) => `permission-of-${code}`,
            open,
          },
    account: {
      id: () => session.user,
      permission: async () => permissions.get(session.user) ?? null,
      setPermission: async (permission) => {
        if (permission) permissions.set(session.user, permission);
        else permissions.delete(session.user);
      },
    },
    tickets: { issue: (userId) => `ticket-${userId}`, read: (ticket) => ticket.replace(/^ticket-/, '') },
    exportAll: async () => backupOf(session.user),
    now: () => clock.now,
    onError: (error) => errors.push(error),
  });
  /** Connects the running user's Drive, as coming back from Google does. */
  const connect = () => drive.connect(session.user);
  return { drive, connect, session, driveOf, errors, clock };
}

test('nothing is copied until the user connects their Drive; connecting writes the first copy', async () => {
  const { drive, connect, driveOf } = setup();
  assert.deepEqual(await drive.runNow(), {
    available: true,
    connected: false,
    lastSavedAt: null,
    lastError: null,
  });

  assert.equal(drive.connectUrl(), 'https://google.test/consent?state=ticket-ana');
  assert.equal(drive.whoIsBack('ticket-ana'), 'ana');
  assert.deepEqual(await connect(), {
    available: true,
    connected: true,
    lastSavedAt: '2026-10-12T12:00:00.000Z',
    lastError: null,
  });
  assert.deepEqual(JSON.parse(driveOf('permission-of-ana').saved[0]!), backupOf('ana'));
});

test('after the first copy, at most one a day; asked by the user, at once', async () => {
  const { drive, connect, driveOf, clock } = setup();
  await connect();
  const { saved } = driveOf('permission-of-ana');

  clock.now = new Date('2026-10-13T11:00:00.000Z');
  await drive.runIfDue();
  assert.equal(saved.length, 1, 'less than a day later nothing is written');
  clock.now = new Date('2026-10-13T12:00:00.000Z');
  await drive.runIfDue();
  assert.equal(saved.length, 2);
  await drive.runNow();
  assert.equal(saved.length, 3);
});

test('two calls at the same time write once', async () => {
  const { drive, connect, driveOf } = setup();
  await connect();
  await Promise.all([drive.runNow(), drive.runNow(), drive.runIfDue()]);
  assert.equal(driveOf('permission-of-ana').saved.length, 2);
});

test('each user copies their own data to their own Drive', async () => {
  const { drive, connect, session, driveOf } = setup();
  await connect();
  session.user = 'beto';
  assert.equal((await drive.status()).connected, false, 'her Drive is not his');
  await connect();

  assert.deepEqual(JSON.parse(driveOf('permission-of-beto').saved[0]!), backupOf('beto'));
  assert.equal(driveOf('permission-of-ana').saved.length, 1);

  // Disconnecting forgets his permission, not hers; what is in Drive stays.
  assert.equal((await drive.disconnect()).connected, false);
  await drive.runNow();
  assert.equal(driveOf('permission-of-beto').saved.length, 1);
  session.user = 'ana';
  assert.equal((await drive.status()).connected, true);
});

test('a failure is reported, not thrown, and the next success clears it', async () => {
  const { drive, connect, driveOf, errors } = setup();
  await connect();
  const mine = driveOf('permission-of-ana');
  mine.failure = new BackupStoreError('not_authorized', 'revoked');
  assert.equal((await drive.runNow()).lastError, 'not_authorized');
  mine.failure = new Error('boom');
  assert.equal((await drive.runNow()).lastError, 'unavailable');
  assert.equal(errors.length, 2);
  mine.failure = null;
  assert.equal((await drive.runNow()).lastError, null);
});

test('without Google credentials on the server nobody can connect', async () => {
  const { drive } = setup({ available: false });
  const off = { available: false, connected: false, lastSavedAt: null, lastError: null };
  assert.deepEqual(await drive.status(), off);
  assert.deepEqual(await drive.runNow(), off);
  assert.throws(() => drive.connectUrl(), /not set up/);
  assert.equal(await codeOf(drive.connect('code')), 'CONFLICT');
});
