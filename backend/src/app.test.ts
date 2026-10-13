import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';
import { API_PREFIX, type ImportPreview } from '@gastos/shared';
import { createApp } from './app';
import { env } from './config/env';
import { createMemoryContainer } from './testing/memoryApp';

/**
 * The real Express app (routes, authentication, body parsers, error handler)
 * over the in-memory backend, asked through HTTP like the frontend does.
 * The user and password are the made-up ones of backend/memory.env.
 */

const PASSWORD = 'demo';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const { container } = createMemoryContainer(env, '2026-10-10');
const server = createApp(container, env).listen(0);
const base = `http://localhost:${(server.address() as AddressInfo).port}${API_PREFIX}`;
after(() => server.close());

let token = '';

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

  const session = await data<{ token: string }>(
    await call('POST', '/auth/login', { username: env.AUTH_USERNAME, password: PASSWORD }, false),
  );
  token = session.token;
  assert.deepEqual(await data<unknown[]>(await call('GET', '/accounts')), []);
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

test('signing out everywhere closes the session that asked for it', async () => {
  assert.equal((await call('POST', '/auth/logout-all')).ok, true);
  assert.equal((await failure(await call('GET', '/accounts'), 401)).code, 'UNAUTHORIZED');
});
