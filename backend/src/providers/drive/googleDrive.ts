import { DRIVE_BACKUP_FILE_NAME, type DriveBackupError } from '@gastos/shared';

/**
 * Where the automatic backup is kept. Nothing outside this folder knows it is
 * Google Drive, so another place (a mail, another cloud) is one new file.
 */
export interface BackupStore {
  /** When the stored copy was last written, or null if there is none yet. */
  lastSavedAt(): Promise<Date | null>;
  /** Writes the copy, replacing the previous one. */
  save(content: string): Promise<void>;
}

/** The one error a store throws. `reason` ends up on the data screen. */
export class BackupStoreError extends Error {
  constructor(
    readonly reason: DriveBackupError,
    message: string,
  ) {
    super(message);
    this.name = 'BackupStoreError';
  }
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
/** Only the files this app creates: the server cannot see the rest of the Drive. */
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
/** A backup of a personal app is small, but Drive can be slow to answer. */
const TIMEOUT_MS = 60_000;
/** An access token is renewed this long before Google says it expires. */
const TOKEN_MARGIN_MS = 60_000;
const SECOND_MS = 1000;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

type Fetch = typeof fetch;

async function send(doFetch: Fetch, url: string, init: RequestInit): Promise<Response> {
  try {
    return await doFetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw new BackupStoreError('unavailable', `Could not reach Google: ${String(error)}`);
  }
}

/** Google answers 400 or 401 to a revoked, expired or mistyped permission. */
async function readToken(
  response: Response,
): Promise<{ access_token?: string; refresh_token?: string; expires_in?: number }> {
  if (response.status === HTTP_BAD_REQUEST || response.status === HTTP_UNAUTHORIZED) {
    throw new BackupStoreError('not_authorized', `Google refused the permission (${response.status})`);
  }
  if (!response.ok) throw new BackupStoreError('unavailable', `Google answered ${response.status}`);
  return (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
}

/** The page where the user grants the app access to its own files in their Drive. */
export function authorizationUrl(clientId: string, redirectUri: string): string {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    // Offline access and a fresh consent are what make Google hand over a refresh token.
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${AUTH_URL}?${query.toString()}`;
}

/** Turns the code Google sent back after consent into the long-lived refresh token. */
export async function exchangeCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  fetch?: Fetch;
}): Promise<string> {
  const response = await send(input.fetch ?? fetch, TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await readToken(response);
  if (!data.refresh_token)
    throw new BackupStoreError('not_authorized', 'Google did not send a refresh token');
  return data.refresh_token;
}

export interface GoogleDriveOptions {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** Injected in tests. */
  fetch?: Fetch;
  now?: () => number;
}

/**
 * Google Drive over plain HTTPS, so the backend needs no extra dependency.
 * Keeps a single file, DRIVE_BACKUP_FILE_NAME, and replaces its content on
 * every save; Drive keeps the earlier versions for a while.
 */
export function createGoogleDriveStore(options: GoogleDriveOptions): BackupStore {
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  let token: { value: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt > now()) return token.value;
    const response = await send(doFetch, TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        refresh_token: options.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = await readToken(response);
    if (!data.access_token) throw new BackupStoreError('unavailable', 'Google sent no access token');
    token = {
      value: data.access_token,
      expiresAt: now() + (data.expires_in ?? 0) * SECOND_MS - TOKEN_MARGIN_MS,
    };
    return token.value;
  }

  async function drive(url: string, init: RequestInit): Promise<Response> {
    const response = await send(doFetch, url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        Authorization: `Bearer ${await accessToken()}`,
      },
    });
    if (response.status === HTTP_UNAUTHORIZED || response.status === HTTP_FORBIDDEN) {
      token = null;
      throw new BackupStoreError('not_authorized', `Drive refused the request (${response.status})`);
    }
    if (!response.ok) throw new BackupStoreError('unavailable', `Drive answered ${response.status}`);
    return response;
  }

  async function findFile(): Promise<{ id: string; modifiedTime: string } | null> {
    const query = new URLSearchParams({
      q: `name = '${DRIVE_BACKUP_FILE_NAME}' and trashed = false`,
      fields: 'files(id,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: '1',
      spaces: 'drive',
    });
    const response = await drive(`${FILES_URL}?${query.toString()}`, { method: 'GET' });
    const data = (await response.json()) as { files?: { id: string; modifiedTime: string }[] };
    return data.files?.[0] ?? null;
  }

  return {
    async lastSavedAt() {
      const file = await findFile();
      return file ? new Date(file.modifiedTime) : null;
    },

    async save(content) {
      const existing = await findFile();
      if (existing) {
        await drive(`${UPLOAD_URL}/${existing.id}?uploadType=media`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: content,
        });
        return;
      }
      // The first time: the file's name and its content travel together.
      const boundary = `gastos-backup-${now()}`;
      const body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify({ name: DRIVE_BACKUP_FILE_NAME, mimeType: 'application/json' }),
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        content,
        `--${boundary}--`,
      ].join('\r\n');
      await drive(`${UPLOAD_URL}?uploadType=multipart`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
    },
  };
}
