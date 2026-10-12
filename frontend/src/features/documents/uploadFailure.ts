import { ApiError } from '../../shared/api/client';
import { errorMessage } from '../../shared/api/errors';
import { es } from '../../shared/i18n/es';

/** Says why an upload was refused, as precisely as the server told us. */
export function uploadFailure(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'DUPLICATE') return es.add.duplicate;
    const reason = (error.details as { reason?: string } | undefined)?.reason;
    if (error.code === 'AI_PROVIDER' && reason && reason in es.documents.errors) {
      return es.documents.errors[reason as keyof typeof es.documents.errors];
    }
  }
  return errorMessage(error);
}
