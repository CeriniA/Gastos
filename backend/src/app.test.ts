import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';
import { API_PREFIX, DATA_SCREEN_PATH, DRIVE_RESULT_PARAM, type ImportPreview } from '@gastos/shared';
import { createApp } from './app';
import { env } from './config/env';
import { runAsUser } from './core/context/owner';
import { createMemoryContainer } from './testing/memoryApp';

/**
 * The real Express app (routes, authentication, body parsers, error handler)
 * over the in-memory backend, asked through HTTP like the frontend does.
 * The user and password are the made-up ones of backend/memory.env.
 */

const PASSWORD = 'demo';
/** The password of the users the tests create. */
const USER_PASSWORD = 'clave-de-prueba';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** A pretend Google: its consent page is just somewhere to read the ticket back from. */
const CONSENT_PAGE = 'https://google.test/consent';

const { container } = createMemoryContainer(env, '2026-10-10', {
  driveProvider: {
    consentUrl: (ticket) => `${CONSENT_PAGE}?state=${ticket}`,
    redeem: async (code) => `permission-${code}`,
    open: () => ({ lastSavedAt: async () => null, save: async () => undefined }),
  },
});
// As the server does on its first start: the admin of the configuration.
await container.users.ensureFirst({ username: env.AUTH_USERNAME, passwordHash: env.AUTH_PASSWORD_HASH });
const server = createApp(container, env).listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}${API_PREFIX}`;
after(() => server.close());

/** Whose session the next calls go with. */
let token = '';

async function signIn(username: string, password: string): Promise<string> {
  const session = await data<{ token: string }>(
    await call('POST', '/auth/login', { username, password }, false),
  );
  return session.token;
}

async function call(method: string, path: string, body?: unknown, auth = true) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(auth ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined || body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined || body instanceof FormData ? body : JSON.stringify(body),
  });
  return response;
}

/** The `data` of a successful answer. */
async function data<T>(response: Response, status = 200): Promise<T> {
  assert.equal(response.status, status, await response.clone().text());
  return ((await response.json()) as { data: T }).data;
}

/** The `error` of a failed answer. */
async function failure(response: Response, status: number) {
  assert.equal(response.status, status);
  const { error } = (await response.json()) as {
    error: { code: string; requestId: string; details?: { issues?: { path: string }[] } };
  };
  assert.ok(error.requestId);
  return error;
}

test('only the health check and the login answer without a token', async () => {
  const health = await data<{ status: string }>(await call('GET', '/health', undefined, false));
  assert.equal(health.status, 'ok');

  assert.equal((await failure(await call('GET', '/accounts', undefined, false), 401)).code, 'UNAUTHORIZED');
  token = 'not-a-token';
  assert.equal((await failure(await call('GET', '/accounts'), 401)).code, 'UNAUTHORIZED');

  const wrong = await call('POST', '/auth/login', { username: env.AUTH_USERNAME, password: 'otra' }, false);
  assert.equal((await failure(wrong, 401)).code, 'INVALID_CREDENTIALS');

  token = await signIn(env.AUTH_USERNAME, PASSWORD);
  assert.deepEqual(await data<unknown[]>(await call('GET', '/accounts')), []);
  const me = await data<{ username: string; role: string }>(await call('GET', '/auth/me'));
  assert.deepEqual([me.username, me.role], [env.AUTH_USERNAME, 'admin']);
});

test('errors come in one shape, with the field that is wrong', async () => {
  const invalid = await failure(await call('POST', '/accounts', { name: '', type: 'bank' }), 400);
  assert.equal(invalid.code, 'VALIDATION');
  assert.ok(invalid.details?.issues?.some((issue) => issue.path === 'name'));

  assert.equal((await failure(await call('GET', '/no-such-route'), 404)).code, 'NOT_FOUND');
  assert.equal((await failure(await call('GET', `/accounts/${'f'.repeat(24)}`), 404)).code, 'NOT_FOUND');
  assert.equal((await failure(await call('GET', '/accounts/not-an-id'), 400)).code, 'VALIDATION');

  const malformed = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{ not json',
  });
  assert.equal((await failure(malformed, 400)).code, 'VALIDATION');
});

test('a transaction is created, listed in pages, sent to the trash and restored', async () => {
  const bank = await data<{ id: string }>(
    await call('POST', '/accounts', { name: 'Banco', type: 'bank', currency: 'ARS' }),
    201,
  );
  assert.equal(
    (await failure(await call('POST', '/accounts', { name: 'banco', type: 'bank', currency: 'ARS' }), 409))
      .code,
    'DUPLICATE',
  );
  const power = await data<{ id: string }>(
    await call('POST', '/categories', { name: 'Luz', kind: 'expense', parentId: null }),
    201,
  );

  // Only what the form sends: the defaults are the server's.
  const created = await data<{ id: string; paymentDate: string; status: string }>(
    await call('POST', '/transactions', {
      type: 'expense',
      date: '2026-10-05',
      amountCents: 1540050,
      currency: 'ARS',
      accountId: bank.id,
      categoryId: power.id,
      description: 'Edesur',
    }),
    201,
  );
  assert.equal(created.paymentDate, '2026-10-05');
  assert.equal(created.status, 'confirmed');

  const page = await data<{ items: { id: string }[]; page: number; pageSize: number; total: number }>(
    await call('GET', '/transactions?month=2026-10&pageSize=1'),
  );
  assert.deepEqual([page.items.length, page.page, page.pageSize, page.total], [1, 1, 1, 1]);

  const summary = await data<unknown>(await call('GET', '/transactions/summary?month=2026-10'));
  assert.match(JSON.stringify(summary), /1540050/);
  assert.equal(
    (await failure(await call('GET', '/transactions/summary?month=octubre'), 400)).code,
    'VALIDATION',
  );

  // An account with history is not deleted.
  assert.equal((await failure(await call('DELETE', `/accounts/${bank.id}`), 409)).code, 'IN_USE');

  assert.equal((await call('DELETE', `/transactions/${created.id}`)).status, 204);
  const trash = await data<{ total: number }>(await call('GET', '/transactions?deleted=true'));
  assert.equal(trash.total, 1);
  await data(await call('POST', `/transactions/${created.id}/restore`));
  assert.equal((await data<{ total: number }>(await call('GET', '/transactions'))).total, 1);
});

test('an Excel file exported by the app is read back, and its rows are known', async () => {
  const exported = await call('GET', '/spreadsheet/export?format=xlsx');
  assert.equal(exported.status, 200);
  assert.equal(exported.headers.get('content-type'), XLSX_TYPE);
  assert.match(exported.headers.get('content-disposition') ?? '', /\.xlsx/);
  const file = new Blob([await exported.arrayBuffer()], { type: XLSX_TYPE });

  const form = new FormData();
  form.append('file', file, 'movimientos.xlsx');
  const preview = await data<ImportPreview>(await call('POST', '/spreadsheet/import/preview', form));
  assert.deepEqual(
    [preview.totalRows, preview.validRows, preview.invalidRows, preview.duplicateRows],
    [1, 1, 0, 1],
  );
  const [entry] = preview.rows;
  assert.equal(entry?.row?.amountCents, 1540050);
  assert.equal(entry?.row?.date, '2026-10-05');
  assert.deepEqual([preview.unknownAccounts, preview.newCategories, preview.missingHeaders], [[], [], []]);

  // The empty template is a valid file with nothing to import.
  const template = await call('GET', '/spreadsheet/template');
  const empty = new FormData();
  empty.append('file', new Blob([await template.arrayBuffer()], { type: XLSX_TYPE }), 'planilla.xlsx');
  const nothing = await data<ImportPreview>(await call('POST', '/spreadsheet/import/preview', empty));
  assert.deepEqual([nothing.totalRows, nothing.missingHeaders], [0, []]);

  assert.equal(
    (await failure(await call('POST', '/spreadsheet/import/preview', new FormData()), 400)).code,
    'VALIDATION',
  );
});

test('the backup is downloaded and put back whole', async () => {
  const exported = await call('GET', '/backup/export');
  assert.equal(exported.status, 200);
  const backup = (await exported.json()) as { collections: Record<string, unknown[]> };
  assert.equal(backup.collections.transactions?.length, 1);

  const [transaction] = (await data<{ items: { id: string }[] }>(await call('GET', '/transactions'))).items;
  assert.equal((await call('DELETE', `/transactions/${transaction?.id}`)).status, 204);
  assert.equal((await data<{ total: number }>(await call('GET', '/transactions'))).total, 0);

  await data(await call('POST', '/backup/restore', backup));
  assert.equal((await data<{ total: number }>(await call('GET', '/transactions'))).total, 1);
  assert.equal(
    (await failure(await call('POST', '/backup/restore', { hola: 1 }), 400)).code,
    'INVALID_BACKUP',
  );
  assert.equal((await data<{ ok: boolean }>(await call('GET', '/backup/integrity'))).ok, true);
});

test('each user has their own data, and none of it reaches another', async () => {
  const admin = token;
  const [mine] = (
    await data<{ items: { id: string; accountId: string }[] }>(await call('GET', '/transactions'))
  ).items;
  assert.ok(mine);
  // A rate and a fixed item of his.
  const rate = await data<{ id: string }>(
    await call('POST', '/exchange-rates', { validFrom: '2026-10-01', arsPerUsd: 1200 }),
    201,
  );
  const fixed = await data<{ id: string }>(
    await call('POST', '/recurrings/from-transaction', { transactionId: mine.id }),
    201,
  );
  // A receipt line he taught the app. Rules are made by confirming a review, so it goes in directly.
  const { userId: adminId } = await data<{ userId: string }>(await call('GET', '/auth/me'));
  const productRule = await runAsUser(adminId, () =>
    container.productRules.save({ name: 'YERB.PLAY 1000', product: 'Yerba', group: 'pantry' }),
  );
  await data(await call('POST', '/users', { username: 'Ana', password: USER_PASSWORD }), 201);

  token = await signIn('ana', USER_PASSWORD);
  assert.deepEqual(await data<unknown[]>(await call('GET', '/product-rules')), []);
  // She starts with the categories and accounts every user starts with, and nothing of his.
  const accounts = await data<{ id: string; name: string }[]>(await call('GET', '/accounts'));
  assert.ok(accounts.length > 0);
  assert.equal(
    accounts.some((account) => account.name === 'Banco'),
    false,
  );
  assert.equal((await data<{ total: number }>(await call('GET', '/transactions'))).total, 0);
  assert.equal((await data<{ total: number }>(await call('GET', '/transactions?deleted=true'))).total, 0);
  assert.deepEqual(await data<unknown[]>(await call('GET', '/tags')), []);
  assert.deepEqual(await data<unknown[]>(await call('GET', '/category-rules')), []);
  assert.deepEqual(await data<unknown[]>(await call('GET', '/documents?status=all')), []);
  const report = await data<{ currencies: unknown[] }>(
    await call('GET', '/reports/categories?month=2026-10'),
  );
  assert.deepEqual(report.currencies, []);
  assert.deepEqual(await data<unknown[]>(await call('GET', '/exchange-rates')), []);
  const balances = await data<{ accountId: string; balanceCents: number }[]>(
    await call('GET', '/accounts/balances'),
  );
  assert.ok(balances.every((balance) => balance.accountId !== mine.accountId && balance.balanceCents === 0));
  const recurrings = await data<{ items: unknown[]; ignored: unknown[] }>(await call('GET', '/recurrings'));
  assert.deepEqual([recurrings.items, recurrings.ignored], [[], []]);
  for (const path of [
    '/reports/accounts?month=2026-10',
    '/reports/merchants?month=2026-10',
    '/reports/evolution?to=2026-10&months=2',
    '/reports/projection',
    '/reports/categories?month=2026-10&in=USD',
  ]) {
    assert.doesNotMatch(JSON.stringify(await data(await call('GET', path))), /1540050|Edesur|Banco/, path);
  }
  assert.doesNotMatch(
    JSON.stringify(await data(await call('GET', '/transactions/summary?month=2026-10'))),
    /1540050/,
  );
  const backup = (await (await call('GET', '/backup/export')).json()) as {
    collections: Record<string, unknown[]>;
  };
  assert.equal(backup.collections.transactions?.length, 0);
  const exported = await (await call('GET', '/spreadsheet/export?format=csv')).text();
  assert.equal(exported.trim().split('\n').length, 1, 'only the header row');

  // Knowing an id of his does not help: for her it does not exist.
  for (const [method, path] of [
    ['GET', `/transactions/${mine.id}`],
    ['PATCH', `/transactions/${mine.id}`],
    ['DELETE', `/transactions/${mine.id}`],
    ['GET', `/accounts/${mine.accountId}`],
    ['DELETE', `/accounts/${mine.accountId}`],
    ['GET', `/accounts/${mine.accountId}/balance`],
    ['DELETE', `/exchange-rates/${rate.id}`],
    ['PATCH', `/exchange-rates/${rate.id}`],
    ['DELETE', `/recurrings/${fixed.id}`],
    ['DELETE', `/product-rules/${productRule.id}`],
    ['PATCH', `/recurrings/${fixed.id}`],
    ['POST', '/recurrings/from-transaction'],
  ] as const) {
    const bodies: Partial<Record<string, object>> = {
      [`/transactions/${mine.id}`]: { description: 'mío' },
      [`/exchange-rates/${rate.id}`]: { validFrom: '2026-10-02', arsPerUsd: 1 },
      [`/recurrings/${fixed.id}`]: { name: 'mío' },
      '/recurrings/from-transaction': { transactionId: mine.id },
    };
    const response = await call(
      method,
      path,
      method === 'DELETE' || method === 'GET' ? undefined : bodies[path],
    );
    assert.equal((await failure(response, 404)).code, 'NOT_FOUND', `${method} ${path}`);
  }
  const borrowed = await call('POST', '/transactions', {
    type: 'expense',
    date: '2026-10-05',
    amountCents: 100,
    currency: 'ARS',
    accountId: mine.accountId,
  });
  assert.equal((await failure(borrowed, 400)).code, 'VALIDATION', 'his account is not hers to use');

  // The same name is hers to use, and what she uploads is only in her tray.
  await data(await call('POST', '/accounts', { name: 'Banco', type: 'bank', currency: 'ARS' }), 201);
  const upload = new FormData();
  upload.append('kind', 'receipt');
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from('ticket de ana'.padEnd(16, '.')),
  ]);
  upload.append('files', new Blob([jpeg], { type: 'image/jpeg' }), 'ticket.jpg');
  await data(await call('POST', '/documents', upload), 202);
  assert.equal((await data<unknown[]>(await call('GET', '/documents'))).length, 1);

  token = admin;
  assert.deepEqual(await data<unknown[]>(await call('GET', '/documents')), []);
  assert.equal((await data<{ total: number }>(await call('GET', '/transactions'))).total, 1);
  assert.deepEqual(
    (await data<{ name: string }[]>(await call('GET', '/accounts'))).map((account) => account.name),
    ['Banco'],
  );
});

test('only an admin manages users; anybody changes their own password', async () => {
  const admin = token;
  const users = await data<{ id: string; username: string; role: string }[]>(await call('GET', '/users'));
  assert.deepEqual(
    users.map((user) => [user.username, user.role]),
    [
      [env.AUTH_USERNAME, 'admin'],
      ['Ana', 'user'],
    ],
  );
  assert.doesNotMatch(JSON.stringify(users), /hash|driveToken/i);
  assert.equal(
    (await failure(await call('POST', '/users', { username: 'ana', password: USER_PASSWORD }), 409)).code,
    'DUPLICATE',
  );
  assert.equal(
    (await failure(await call('POST', '/users', { username: 'beto', password: 'corta' }), 400)).code,
    'VALIDATION',
  );
  const ana = users.find((user) => user.username === 'Ana')!;

  token = await signIn('ana', USER_PASSWORD);
  for (const [method, path, body] of [
    ['GET', '/users', undefined],
    ['POST', '/users', { username: 'beto', password: USER_PASSWORD }],
    ['PATCH', `/users/${ana.id}`, { active: true }],
  ] as const) {
    assert.equal((await failure(await call(method, path, body), 403)).code, 'FORBIDDEN', `${method} ${path}`);
  }

  const wrong = await call('POST', '/users/me/password', {
    currentPassword: 'no-es',
    newPassword: 'otra-clave-1',
  });
  assert.equal((await failure(wrong, 400)).code, 'VALIDATION');
  const changed = await call('POST', '/users/me/password', {
    currentPassword: USER_PASSWORD,
    newPassword: 'otra-clave-1',
  });
  assert.equal(changed.status, 204);
  assert.equal(
    (await failure(await call('GET', '/accounts'), 401)).code,
    'UNAUTHORIZED',
    'the old session is closed',
  );
  token = await signIn('ana', 'otra-clave-1');
  assert.equal((await call('GET', '/accounts')).status, 200);

  // Switched off by the admin, she is out at once; switched back on, she can sign in again.
  const hers = token;
  token = admin;
  await data(await call('PATCH', `/users/${ana.id}`, { active: false }));
  token = hers;
  assert.equal((await failure(await call('GET', '/accounts'), 401)).code, 'UNAUTHORIZED');
  token = admin;
  await data(await call('PATCH', `/users/${ana.id}`, { active: true }));
});

test('each user connects their own Drive, coming back from Google without a session', async () => {
  const admin = token;
  token = await signIn('ana', 'otra-clave-1');
  const off = await data<{ available: boolean; connected: boolean }>(await call('GET', '/backup/drive'));
  assert.deepEqual([off.available, off.connected], [true, false]);

  const { url } = await data<{ url: string }>(await call('POST', '/backup/drive/connect'));
  const ticket = new URL(url).searchParams.get('state')!;
  assert.ok(url.startsWith(CONSENT_PAGE));
  const callback = (query: Record<string, string>) =>
    fetch(`${base}/backup/drive/callback?${new URLSearchParams(query).toString()}`, { redirect: 'manual' });
  const landing = (response: Response) => new URL(response.headers.get('location') ?? '');

  const forged = await callback({ code: 'x', state: 'not-a-ticket' });
  assert.equal(landing(forged).searchParams.get(DRIVE_RESULT_PARAM), 'failed');
  const refused = await callback({ error: 'access_denied', state: ticket });
  assert.equal(landing(refused).searchParams.get(DRIVE_RESULT_PARAM), 'refused');
  assert.equal((await data<{ connected: boolean }>(await call('GET', '/backup/drive'))).connected, false);

  const granted = await callback({ code: 'granted', state: ticket });
  assert.equal(granted.status, 302);
  assert.equal(
    landing(granted).origin + landing(granted).pathname,
    `${env.CORS_ORIGIN[0]}${DATA_SCREEN_PATH}`,
  );
  assert.equal(landing(granted).searchParams.get(DRIVE_RESULT_PARAM), 'connected');
  assert.equal((await data<{ connected: boolean }>(await call('GET', '/backup/drive'))).connected, true);

  // Her Drive is hers: his is still not connected, and she can let go of hers.
  token = admin;
  assert.equal((await data<{ connected: boolean }>(await call('GET', '/backup/drive'))).connected, false);
  token = await signIn('ana', 'otra-clave-1');
  assert.equal((await data<{ connected: boolean }>(await call('DELETE', '/backup/drive'))).connected, false);
  token = admin;
});

test('signing out everywhere closes the session that asked for it', async () => {
  assert.equal((await call('POST', '/auth/logout-all')).ok, true);
  assert.equal((await failure(await call('GET', '/accounts'), 401)).code, 'UNAUTHORIZED');
});
