import { MAX_ERROR_DETAIL } from '@gastos/shared';
import { extractionFailure, type AiExtractor, type ExtractionInput } from './aiExtractor';
import { normalizeExtraction } from './normalize';
import { PROMPT_VERSION, buildPrompt } from './prompt';

/**
 * Google Gemini behind the AiExtractor interface, called over plain HTTPS so
 * the backend needs no extra dependency.
 *
 * The answer format is described in the prompt and enforced by
 * normalizeExtraction, not by the API's own schema options: those have been
 * renamed across API versions, and the prompt-plus-validation route keeps
 * working whichever one is current.
 */

export interface GeminiOptions {
  apiKey: string;
  model: string;
  /** Injected in tests. */
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
/** A long receipt in several photos can take a while to read. */
const DEFAULT_TIMEOUT_MS = 90_000;
/** Waits before retrying a rate-limited or overloaded request. */
const RETRY_DELAYS_MS = [2_000, 6_000];

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export function createGeminiExtractor(options: GeminiOptions): AiExtractor {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const url = `${ENDPOINT}/${encodeURIComponent(options.model)}:generateContent`;

  async function post(body: unknown): Promise<Response> {
    try {
      return await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      throw extractionFailure('unavailable', 'Could not reach the AI service', { cause: String(error) });
    }
  }

  async function call(input: ExtractionInput): Promise<string> {
    const contents = [
      {
        role: 'user',
        parts: [
          ...input.files.map((file) => ({
            inline_data: { mime_type: file.mimeType, data: file.content.toString('base64') },
          })),
          { text: buildPrompt(input) },
        ],
      },
    ];
    // Asking for JSON output makes answers cleaner. If this API version does
    // not know the option, the request is repeated without it.
    let body: Record<string, unknown> = {
      contents,
      generationConfig: { responseMimeType: 'application/json' },
    };

    for (let attempt = 0; ; attempt += 1) {
      const response = await post(body);
      if (response.ok) {
        const data = (await response.json()) as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
        if (text.trim() !== '') return text;
        throw extractionFailure('blocked', 'The model returned no answer', {
          blockReason: data.promptFeedback?.blockReason,
          finishReason: data.candidates?.[0]?.finishReason,
        });
      }

      const status = response.status;
      const detail = (await response.text().catch(() => '')).slice(0, MAX_ERROR_DETAIL);
      if (status === 400 && 'generationConfig' in body) {
        body = { contents };
        continue;
      }
      if (status === 401 || status === 403) {
        throw extractionFailure('not_configured', 'The AI service rejected the API key', { status, detail });
      }
      const retryable = status === 429 || status >= 500;
      const delay = RETRY_DELAYS_MS[attempt];
      if (retryable && delay !== undefined) {
        await sleep(delay);
        continue;
      }
      throw extractionFailure(
        status === 429 ? 'rate_limited' : 'unavailable',
        'The AI service returned an error',
        {
          status,
          detail,
        },
      );
    }
  }

  return {
    promptVersion: PROMPT_VERSION,
    async extract(input) {
      const answer = await call(input);
      return normalizeExtraction(answer, {
        kind: input.kind,
        categories: input.categories,
        today: input.today,
      });
    },
  };
}
