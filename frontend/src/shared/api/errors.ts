import { es } from '../i18n/es';
import { ApiError } from './client';

/** The Spanish sentence to show for any thrown error. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const firstIssue = error.issues[0];
    if (error.code === 'VALIDATION' && firstIssue) return fieldMessage(firstIssue.message);
    return es.errors[error.code];
  }
  return es.errors.INTERNAL;
}

/** The sentence for the first thing a shared schema found wrong in a form. */
export function firstProblem(issues: readonly { message: string }[]): string {
  return fieldMessage(issues[0]?.message ?? 'required');
}

/** Translates a field message produced by the shared rules or the server. */
export function fieldMessage(message: string): string {
  return es.fieldMessages[message] ?? es.fieldMessages.invalid ?? message;
}
