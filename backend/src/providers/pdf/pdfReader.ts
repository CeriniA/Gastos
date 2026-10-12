/**
 * The app's only view of a PDF library: hand over a PDF, get back the text of
 * each page. Like the AI, the library behind it can be swapped in one file.
 */
export interface PdfTextReader {
  /** Throws PdfReadError. Refuses a PDF longer than `maxPages` before reading any page. */
  read(content: Buffer, options: { password?: string; maxPages: number }): Promise<{ pages: string[] }>;
}

export type PdfFailure = 'password_required' | 'wrong_password' | 'too_many_pages' | 'unreadable';

export class PdfReadError extends Error {
  constructor(
    readonly reason: PdfFailure,
    message: string,
  ) {
    super(message);
    this.name = 'PdfReadError';
  }
}
