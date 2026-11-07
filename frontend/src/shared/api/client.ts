import { API_PREFIX, ERROR_CODES, type ApiErrorBody, type ErrorCode } from '@gastos/shared';

/**
 * The only module that talks to the backend. It attaches the session token,
 * unwraps the `{ data }` envelope and turns every failure into an ApiError.
 */

const ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const BASE_URL = `${ORIGIN}${API_PREFIX}`;
const TOKEN_KEY = 'gastos.token';
const DOWNLOAD_RELEASE_MS = 10_000;

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK',
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(code);
    this.name = 'ApiError';
  }

  /** Field problems reported by the server, as { path, message } pairs. */
  get issues(): { path: string; message: string }[] {
    const details = this.details as { issues?: unknown } | undefined;
    return Array.isArray(details?.issues) ? (details.issues as { path: string; message: string }[]) : [];
  }
}

let memoryToken: string | null = null;
const unauthorizedListeners = new Set<() => void>();

/** localStorage can be unavailable (private mode); the token then lives in memory. */
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
    } catch {
      return memoryToken;
    }
  },
  set(token: string): void {
    memoryToken = token;
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Kept in memory only.
    }
  },
  clear(): void {
    memoryToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing stored.
    }
  },
};

/** Called when the server rejects the token, so the app can go back to the login. */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  formData?: FormData;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new ApiError('NETWORK', 0);
  }
  if (response.ok) return response;

  let code: ErrorCode = 'INTERNAL';
  let details: unknown;
  try {
    const body = (await response.json()) as ApiErrorBody;
    if ((ERROR_CODES as readonly string[]).includes(body.error.code)) code = body.error.code;
    details = body.error.details;
  } catch {
    // Not a JSON error body (e.g. the host's own error page).
  }
  if (response.status === 401 && code === 'UNAUTHORIZED') {
    // Only if the session is still the one that sent this request: a slow 401 must not
    // log out someone who signed in again meanwhile.
    if (tokenStore.get() === token) {
      tokenStore.clear();
      unauthorizedListeners.forEach((listener) => listener());
    }
  }
  throw new ApiError(code, response.status, details);
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as { data: T };
  return body.data;
}

/** Fetches binary content (an image) with the session token. */
export async function fetchBlob(path: string): Promise<Blob> {
  const response = await send(path, {});
  return response.blob();
}

/** Fetches a file with the session token and hands it to the browser to save. */
export async function download(path: string, query?: Query): Promise<void> {
  const response = await send(path, { query });
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const fileName = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'gastos';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // The browser needs a moment to start the download before the link can be released.
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_RELEASE_MS);
}
