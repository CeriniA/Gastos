import type { ErrorCode } from '@gastos/shared';

/**
 * Services throw these; the error middleware turns them into HTTP responses.
 * Messages are for developers and logs. The frontend shows its own Spanish
 * text based on `code`.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(404, 'NOT_FOUND', `${entity} not found`, { entity, id });
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION', message, details);
  }
}

/** One field broke a business rule. Same shape as schema validation issues. */
export function fieldError(path: string, message: string): ValidationError {
  return new ValidationError(message, { issues: [{ path, message }] });
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown, code: ErrorCode = 'CONFLICT') {
    super(409, code, message, details);
  }
}

export class DuplicateError extends ConflictError {
  constructor(entity: string, field: string) {
    super(`${entity} with the same ${field} already exists`, { entity, field }, 'DUPLICATE');
  }
}

/** The entity cannot be deleted because other data points at it. */
export class InUseError extends ConflictError {
  constructor(entity: string, usedBy: string, count: number) {
    super(`${entity} is used by ${count} ${usedBy}`, { entity, usedBy, count }, 'IN_USE');
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: 'UNAUTHORIZED' | 'INVALID_CREDENTIALS' = 'UNAUTHORIZED') {
    super(401, code, code === 'UNAUTHORIZED' ? 'Authentication required' : 'Wrong username or password');
  }
}

/** Signed in, but this is not for them (only an admin manages users). */
export class ForbiddenError extends AppError {
  constructor() {
    super(403, 'FORBIDDEN', 'Not allowed');
  }
}

/** The user already sent to the AI every document they can today. */
export class AiLimitError extends AppError {
  constructor(limit: number) {
    super(429, 'AI_LIMIT', 'Daily AI limit reached', { limit });
  }
}

export class AiProviderError extends AppError {
  constructor(message: string, details?: unknown) {
    super(502, 'AI_PROVIDER', message, details);
  }
}
