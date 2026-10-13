import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DRIVE_BACKUP_FILE_NAME } from '@gastos/shared';
import { BackupStoreError, authorizationUrl, createGoogleDriveStore, exchangeCode } from './googleDrive';

/** Google Drive against a scripted HTTP layer: no network involved. */

interface Sent {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

function setup(responses: (() => Response)[]) {
  const sent: Sent[] = [];
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({
      url: String(url),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: String(init?.body ?? ''),
    });
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return next();
  }) as typeof fetch;
  const store = createGoogleDriveStore({
    clientId: 'client',
    clientSecret: 'secret',
    refreshToken: 'refresh',
    fetch: fakeFetch,
    now: () => 1_000_000,
  });
  return { store, sent };
}

const json =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status });
const token = json({ access_token: 'access', expires_in: 3600 });
const noFile = json({ files: [] });
const oneFile = json({ files: [{ id: 'file-1', modifiedTime: '2026-10-11T09:30:00.000Z' }] });

test('the first copy creates the file, with its name, using a token from the refresh token', async () => {
  const { store, sent } = setup([token, noFile, json({ id: 'file-1' })]);
  await store.save('{"app":"gastos"}');

  assert.match(sent[0]!.body, /grant_type=refresh_token/);
  assert.match(sent[0]!.body, /refresh_token=refresh/);
  assert.equal(
    new URL(sent[1]!.url).searchParams.get('q'),
    `name = '${DRIVE_BACKUP_FILE_NAME}' and trashed = false`,
  );
  assert.equal(sent[1]!.headers.Authorization, 'Bearer access');
  assert.equal(sent[2]!.method, 'POST');
  assert.match(sent[2]!.url, /uploadType=multipart/);
  assert.match(sent[2]!.body, new RegExp(`"name":"${DRIVE_BACKUP_FILE_NAME}"`));
  assert.match(sent[2]!.body, /\{"app":"gastos"\}/);
});

test('later copies replace the same file, and the token is reused while valid', async () => {
  const { store, sent } = setup([token, oneFile, json({}), oneFile, json({})]);
  await store.save('first');
  await store.save('second');
  const writes = sent.filter((request) => request.method === 'PATCH');
  assert.equal(writes.length, 2);
  assert.ok(writes.every((request) => request.url.includes('/files/file-1?uploadType=media')));
  assert.equal(writes[1]!.body, 'second');
  assert.equal(sent.filter((request) => request.url.includes('oauth2')).length, 1);
});

test('the date of the copy in Drive is read from the file', async () => {
  const { store } = setup([token, oneFile]);
  assert.equal((await store.lastSavedAt())?.toISOString(), '2026-10-11T09:30:00.000Z');
  const empty = setup([token, noFile]);
  assert.equal(await empty.store.lastSavedAt(), null);
});

async function reasonOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    assert.ok(error instanceof BackupStoreError, `expected BackupStoreError, got ${String(error)}`);
    return error.reason;
  }
  assert.fail('expected the request to fail');
}

test('a revoked permission and an unreachable Google are told apart', async () => {
  assert.equal(
    await reasonOf(setup([json({ error: 'invalid_grant' }, 400)]).store.lastSavedAt()),
    'not_authorized',
  );
  assert.equal(await reasonOf(setup([token, json({}, 403)]).store.lastSavedAt()), 'not_authorized');
  assert.equal(await reasonOf(setup([token, json({}, 503)]).store.lastSavedAt()), 'unavailable');
  const offline = setup([
    () => {
      throw new TypeError('fetch failed');
    },
  ]);
  assert.equal(await reasonOf(offline.store.lastSavedAt()), 'unavailable');
});

test('the consent page asks only for the app files, with offline access', async () => {
  const url = new URL(authorizationUrl('client', 'http://127.0.0.1:53682', 'who-is-asking'));
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.file');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:53682');
  assert.equal(url.searchParams.get('state'), 'who-is-asking');

  const { sent } = setup([]);
  const refreshToken = await exchangeCode({
    clientId: 'client',
    clientSecret: 'secret',
    code: 'the-code',
    redirectUri: 'http://127.0.0.1:53682',
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      sent.push({ url: String(url), method: 'POST', headers: {}, body: String(init?.body) });
      return new Response(JSON.stringify({ refresh_token: 'long-lived' }));
    }) as typeof fetch,
  });
  assert.equal(refreshToken, 'long-lived');
  assert.match(sent[0]!.body, /grant_type=authorization_code/);
});
