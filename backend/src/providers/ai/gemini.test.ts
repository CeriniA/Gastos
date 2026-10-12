import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AiProviderError } from '../../core/errors/errors';
import { failureReason, type ExtractionInput } from './aiExtractor';
import { createGeminiExtractor } from './gemini';

/** The Gemini provider against a scripted HTTP layer: no network involved. */

const input: ExtractionInput = {
  kind: 'receipt',
  files: [
    { content: Buffer.from('first-image'), mimeType: 'image/jpeg' },
    { content: Buffer.from('second-image'), mimeType: 'image/png' },
  ],
  categories: [{ id: 'a'.repeat(24), kind: 'expense', path: 'Vivienda > Servicios > Luz' }],
  today: '2026-10-10',
};

const modelAnswer = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }), {
    status: 200,
  });
const good = () =>
  modelAnswer(
    JSON.stringify({
      transactions: [{ type: 'expense', amount: '100.50', currency: 'ARS', date: '2026-10-05' }],
    }),
  );

function setup(responses: (() => Response | Promise<Response>)[]) {
  const requests: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const sleeps: number[] = [];
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(url),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return next();
  }) as typeof fetch;
  const extractor = createGeminiExtractor({
    apiKey: 'test-key',
    model: 'gemini-test',
    fetch: fakeFetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { extractor, requests, sleeps };
}

async function reasonOf(work: Promise<unknown>): Promise<string | null> {
  try {
    await work;
  } catch (error) {
    assert.ok(error instanceof AiProviderError, `expected AiProviderError, got ${String(error)}`);
    return failureReason(error);
  }
  assert.fail('expected the extraction to fail');
}

test('sends the images and the instructions, with the key in a header', async () => {
  const { extractor, requests } = setup([good]);
  const result = await extractor.extract(input);

  assert.equal(result.transactions[0]?.amountCents, 10050);
  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(
    request?.url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
  );
  assert.equal(request?.headers['x-goog-api-key'], 'test-key');
  assert.ok(!request?.url.includes('test-key'), 'the key must not travel in the URL');

  const contents = request?.body.contents as { parts: Record<string, unknown>[] }[];
  const parts = contents[0]?.parts ?? [];
  assert.deepEqual(parts[0], {
    inline_data: { mime_type: 'image/jpeg', data: Buffer.from('first-image').toString('base64') },
  });
  assert.deepEqual(parts[1], {
    inline_data: { mime_type: 'image/png', data: Buffer.from('second-image').toString('base64') },
  });
  const prompt = String(parts[2]?.text);
  assert.match(prompt, /Vivienda > Servicios > Luz/);
  assert.match(prompt, /Today is 2026-10-10/);
  assert.match(prompt, /Do not output card numbers/);
});

test('waits and retries when the service is rate limited or overloaded', async () => {
  const { extractor, requests, sleeps } = setup([
    () => new Response('quota', { status: 429 }),
    () => new Response('overloaded', { status: 503 }),
    good,
  ]);
  assert.equal((await extractor.extract(input)).transactions.length, 1);
  assert.equal(requests.length, 3);
  assert.deepEqual(sleeps, [2000, 6000]);
});

test('gives up after the retries and says why', async () => {
  const limited = setup([1, 2, 3].map(() => () => new Response('quota', { status: 429 })));
  assert.equal(await reasonOf(limited.extractor.extract(input)), 'rate_limited');
  assert.equal(limited.requests.length, 3);

  const down = setup([1, 2, 3].map(() => () => new Response('boom', { status: 500 })));
  assert.equal(await reasonOf(down.extractor.extract(input)), 'unavailable');
});

test('a rejected key is reported as a configuration problem, without retrying', async () => {
  const { extractor, requests } = setup([() => new Response('API key not valid', { status: 403 })]);
  assert.equal(await reasonOf(extractor.extract(input)), 'not_configured');
  assert.equal(requests.length, 1);
});

test('repeats the request without the output option if the API does not accept it', async () => {
  const { extractor, requests } = setup([
    () => new Response('Unknown name "responseMimeType"', { status: 400 }),
    good,
  ]);
  assert.equal((await extractor.extract(input)).transactions.length, 1);
  assert.ok('generationConfig' in (requests[0]?.body ?? {}));
  assert.ok(!('generationConfig' in (requests[1]?.body ?? {})));

  const stillBad = setup([
    () => new Response('bad', { status: 400 }),
    () => new Response('bad', { status: 400 }),
  ]);
  assert.equal(await reasonOf(stillBad.extractor.extract(input)), 'unavailable');
});

test('network failures, blocked answers and nonsense are each named', async () => {
  const offline = setup([
    () => {
      throw new TypeError('fetch failed');
    },
  ]);
  assert.equal(await reasonOf(offline.extractor.extract(input)), 'unavailable');

  const blocked = setup([
    () =>
      new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] }), {
        status: 200,
      }),
  ]);
  assert.equal(await reasonOf(blocked.extractor.extract(input)), 'blocked');

  const nonsense = setup([() => modelAnswer('No veo ningún comprobante.')]);
  assert.equal(await reasonOf(nonsense.extractor.extract(input)), 'unreadable');
});

test("a card statement's text travels after the instructions, with no image", async () => {
  const { extractor, requests } = setup([good]);
  await extractor.extract({ ...input, kind: 'card_statement', files: [], text: 'RESUMEN VISA' });
  const contents = requests[0]?.body.contents as { parts: Record<string, unknown>[] }[];
  const parts = contents[0]?.parts ?? [];
  assert.equal(parts.length, 2);
  assert.match(String(parts[0]?.text), /credit card statement/);
  assert.match(String(parts[0]?.text), /"statement"/);
  assert.deepEqual(parts[1], { text: 'RESUMEN VISA' });
});
