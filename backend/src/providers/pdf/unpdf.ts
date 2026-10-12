import { extractText, getDocumentProxy } from 'unpdf';
import { PdfReadError, type PdfTextReader } from './pdfReader';

/** How PDF.js says why it wants a password (its PasswordResponses). */
const INCORRECT_PASSWORD = 2;

function toFailure(error: unknown): PdfReadError {
  const { name, code } = (error ?? {}) as { name?: string; code?: number };
  if (name === 'PasswordException') {
    return code === INCORRECT_PASSWORD
      ? new PdfReadError('wrong_password', 'The PDF password is wrong')
      : new PdfReadError('password_required', 'The PDF is protected with a password');
  }
  return new PdfReadError('unreadable', String(error instanceof Error ? error.message : error));
}

/**
 * PDF.js through unpdf, which needs no native parts. Only text is extracted:
 * nothing is rendered. The PDF.js version unpdf brings no longer evaluates
 * code from a PDF at all, so there is no option to turn off.
 */
export function createUnpdfReader(): PdfTextReader {
  return {
    async read(content, { password, maxPages }) {
      let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
      try {
        // A copy: PDF.js takes over the bytes it is given.
        pdf = await getDocumentProxy(new Uint8Array(content), { password });
      } catch (error) {
        throw toFailure(error);
      }
      try {
        if (pdf.numPages > maxPages)
          throw new PdfReadError('too_many_pages', `The PDF has ${pdf.numPages} pages`);
        const { text } = await extractText(pdf, { mergePages: false });
        return { pages: text };
      } catch (error) {
        throw error instanceof PdfReadError ? error : toFailure(error);
      } finally {
        // How unpdf itself frees a document: through the task that loaded it.
        await pdf.loadingTask.destroy();
      }
    },
  };
}
