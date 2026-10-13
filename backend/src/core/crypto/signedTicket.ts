import jwt from 'jsonwebtoken';

/**
 * A short-lived note the server writes to itself and gets back through
 * somebody else: it says who it is about, and nobody can forge or alter it.
 * Used to recognise the user Google sends back after they grant a permission.
 */
export function createTicketOffice(secret: string, purpose: string, validSeconds: number) {
  return {
    issue(subject: string): string {
      return jwt.sign({ sub: subject, purpose }, secret, { algorithm: 'HS256', expiresIn: validSeconds });
    },

    /** Who the ticket is about, or null when it is forged, expired or meant for something else. */
    read(ticket: string): string | null {
      try {
        const payload = jwt.verify(ticket, secret, { algorithms: ['HS256'] });
        if (typeof payload === 'string' || payload.purpose !== purpose) return null;
        return payload.sub ?? null;
      } catch {
        return null;
      }
    },
  };
}
