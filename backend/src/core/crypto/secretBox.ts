import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
/** AES-256 takes a key of this many bytes. */
const KEY_BYTES = 32;
/** The nonce length GCM is designed for. */
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const ENCODING = 'base64url';

/**
 * Keeps a secret readable only by this server: what is stored in the database
 * is sealed, and a copy of the database alone does not give it away.
 *
 * The key is derived from the server's own secret and a `purpose`, so each use
 * has its own key and none of them is the secret itself.
 */
export function createSecretBox(secret: string, purpose: string) {
  const key = Buffer.from(hkdfSync('sha256', secret, '', purpose, KEY_BYTES));

  return {
    seal(text: string): string {
      const nonce = randomBytes(NONCE_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, nonce);
      const sealed = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
      return Buffer.concat([nonce, cipher.getAuthTag(), sealed]).toString(ENCODING);
    },

    /** Null when it was not sealed by this server (another secret) or was tampered with. */
    open(sealed: string): string | null {
      try {
        const bytes = Buffer.from(sealed, ENCODING);
        const decipher = createDecipheriv(ALGORITHM, key, bytes.subarray(0, NONCE_BYTES));
        decipher.setAuthTag(bytes.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES));
        const text = Buffer.concat([
          decipher.update(bytes.subarray(NONCE_BYTES + TAG_BYTES)),
          decipher.final(),
        ]);
        return text.toString('utf8');
      } catch {
        return null;
      }
    },
  };
}
