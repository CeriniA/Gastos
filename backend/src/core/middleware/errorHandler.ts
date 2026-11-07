import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody, ErrorCode } from '@gastos/shared';
import { isDuplicateKey } from '../db/mongoErrors';
import { AppError } from '../errors/errors';
import { logger } from '../logger';
import { HTTP_STATUS } from '../http/status';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(HTTP_STATUS.notFound, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
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
      status: HTTP_STATUS.badRequest,
      code: 'VALIDATION',
      message: 'Invalid data',
      details: {
        issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
    };
  }
  // MongoDB unique index violation: the database is the last line of defence.
  if (isDuplicateKey(error)) {
    return { status: HTTP_STATUS.conflict, code: 'DUPLICATE', message: 'Duplicate value', details: error.keyValue };
  }
  if (isRecord(error)) {
    if (error.type === 'entity.too.large' || error.code === 'LIMIT_FILE_SIZE') {
      return { status: HTTP_STATUS.payloadTooLarge, code: 'PAYLOAD_TOO_LARGE', message: 'File or request too large' };
    }
    if (error.type === 'entity.parse.failed' || error.name === 'MulterError') {
      return { status: HTTP_STATUS.badRequest, code: 'VALIDATION', message: 'Malformed request' };
    }
  }
  return { status: HTTP_STATUS.internal, code: 'INTERNAL', message: 'Unexpected error' };
}

/** The single place where errors become HTTP responses. */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const mapped = mapError(error);
  const requestId = String(req.id ?? '');
  if (mapped.status >= HTTP_STATUS.internal) {
    logger.error({ err: error, requestId }, 'Unhandled error');
  }
  const body: ApiErrorBody = {
    error: { code: mapped.code, message: mapped.message, details: mapped.details, requestId },
  };
  res.status(mapped.status).json(body);
};
