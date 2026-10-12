import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody, ErrorCode } from '@gastos/shared';
import { AppError } from '../errors/errors';
import { logger } from '../logger';

/** MongoDB's code for a unique index violation. */
const MONGO_DUPLICATE_KEY = 11000;

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
};

interface Mapped {
  status: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mapError(error: unknown): Mapped {
  if (error instanceof AppError) {
    return { status: error.status, code: error.code, message: error.message, details: error.details };
  }
  if (error instanceof ZodError) {
    return {
      status: 400,
      code: 'VALIDATION',
      message: 'Invalid data',
      details: {
        issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
    };
  }
  if (isRecord(error)) {
    // MongoDB unique index violation: the database is the last line of defence.
    if (error.code === MONGO_DUPLICATE_KEY) {
      return { status: 409, code: 'DUPLICATE', message: 'Duplicate value', details: error.keyValue };
    }
    if (error.type === 'entity.too.large' || error.code === 'LIMIT_FILE_SIZE') {
      return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'File or request too large' };
    }
    if (error.type === 'entity.parse.failed' || error.name === 'MulterError') {
      return { status: 400, code: 'VALIDATION', message: 'Malformed request' };
    }
  }
  return { status: 500, code: 'INTERNAL', message: 'Unexpected error' };
}

/** The single place where errors become HTTP responses. */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const mapped = mapError(error);
  const requestId = String(req.id ?? '');
  if (mapped.status >= 500) {
    logger.error({ err: error, requestId }, 'Unhandled error');
  }
  const body: ApiErrorBody = {
    error: { code: mapped.code, message: mapped.message, details: mapped.details, requestId },
  };
  res.status(mapped.status).json(body);
};
