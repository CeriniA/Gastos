import type { Response } from 'express';
import type { z } from 'zod';
import type { ApiSuccessBody } from '@gastos/shared';
import { ValidationError } from '../errors/errors';

/**
 * Validates request data against a shared schema. Controllers call this for
 * body, query and params before touching a service, so services only ever
 * receive well-formed input.
 */
export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Invalid request', {
      issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  return result.data;
}

/** Every successful JSON response has the same envelope: { data }. */
export function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccessBody<T> = { data };
  res.status(status).json(body);
}

export function noContent(res: Response): void {
  res.status(204).end();
}

export function sendFile(
  res: Response,
  file: { fileName: string; contentType: string; content: Buffer },
): void {
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.send(file.content);
}
