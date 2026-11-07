import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOpenExchangeRates } from './openExchangeRates';

const body = {
  result: 'success',
  time_last_update_unix: 1791590551,
  rates: { BRL: 1, ARS: 302.622281, USD: 0.199518 },
};

function setup(responses: (() => Response)[]) {
  const urls: string[] = [];
  const failures: unknown[] = [];
  let clock = 1_000_000;
  const provider = createOpenExchangeRates({
    fetch: (async (url: string | URL | Request) => {
      urls.push(String(url));
      const next = responses.shift();
      if (!next) throw new Error('unexpected request');
      return next();
    }) as typeof fetch,
    now: () => clock,
    cacheMs: 1000,
    onError: (error) => failures.push(error),
  });
  return { provider, urls, failures, advance: (ms: number) => (clock += ms) };
}

test('returns the rate between two currencies with its date and source', async () => {
  const { provider, urls } = setup([() => new Response(JSON.stringify(body))]);
  assert.deepEqual(await provider.reference('BRL', 'ARS'), {
    rate: 302.622281,
    from: 'BRL',
    to: 'ARS',
    asOf: '2026-10-10',
    source: 'exchangerate-api.com',
  });
  assert.deepEqual(urls, ['https://open.er-api.com/v6/latest/BRL']);
});

test('answers are cached per base currency for a while', async () => {
  const { provider, urls, advance } = setup([
    () => new Response(JSON.stringify(body)),
    () => new Response(JSON.stringify({ ...body, rates: { ...body.rates, ARS: 310 } })),
  ]);
  await provider.reference('BRL', 'ARS');
  assert.equal((await provider.reference('BRL', 'USD'))?.rate, 0.199518);
  assert.equal(urls.length, 1);
  advance(2000);
  assert.equal((await provider.reference('BRL', 'ARS'))?.rate, 310);
  assert.equal(urls.length, 2);
});

test('a source that is down, or does not know the currency, yields nothing instead of failing', async () => {
  const down = setup([() => new Response('oops', { status: 503 })]);
  assert.equal(await down.provider.reference('BRL', 'ARS'), null);
  assert.equal(down.failures.length, 1); // reported, so it shows in the log

  const offline = setup([
    () => {
      throw new TypeError('fetch failed');
    },
  ]);
  assert.equal(await offline.provider.reference('BRL', 'ARS'), null);

  const unknown = setup([
    () => new Response(JSON.stringify(body)),
    () => new Response(JSON.stringify({ result: 'error', 'error-type': 'unsupported-code' })),
  ]);
  assert.equal(await unknown.provider.reference('BRL', 'XXX'), null);
  assert.equal(await unknown.provider.reference('ZZZ', 'ARS'), null);
});
