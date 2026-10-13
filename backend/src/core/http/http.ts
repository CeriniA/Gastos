import type { RequestHandler, Response } from 'express';
import type { z } from 'zod';
import type { ApiSuccessBody } from '@gastos/shared';
import { runAsUser } from '../context/owner';
import { ValidationError } from '../errors/errors';
import { sessionOf } from '../middleware/auth';

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

/**
 * Makes every handler of a controller run on behalf of the signed-in user, so
 * all the data it reaches is theirs (core/context/owner.ts). Every controller
 * of user data returns its handlers through this.
 *
 * It is done here, at the last step, and not in a middleware: reading a
 * request's body or its files happens between the two, and the owner would not
 * survive it.
 */
export function asUser<T extends Record<string, RequestHandler>>(handlers: T): T {
  const scoped = Object.entries(handlers).map(([name, handler]) => {
    const asOwner: RequestHandler = (req, res, next) =>
      runAsUser(sessionOf(res).userId, () => handler(req, res, next));
    return [name, asOwner];
  });
  return Object.fromEntries(scoped) as T;
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
