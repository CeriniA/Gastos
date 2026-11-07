import type { RequestHandler } from 'express';
import { idParamsSchema, passwordChangeSchema, userCreateSchema, userUpdateSchema } from '@gastos/shared';
import { noContent, ok, parse } from '../../core/http/http';
import { sessionOf } from '../../core/middleware/auth';
import type { UsersService } from './users.service';
import { HTTP_STATUS } from '../../core/http/status';

/** Users are not anybody's data, so these handlers do not run through `asUser`. */
export function createUsersController(service: UsersService) {
  const list: RequestHandler = async (_req, res) => {
    ok(res, await service.list());
  };
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(userCreateSchema, req.body)), HTTP_STATUS.created);
  };
  const update: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.update(id, parse(userUpdateSchema, req.body), sessionOf(res).userId));
  };
  /** Anybody changes their own password; it closes their sessions, this one included. */
  const changePassword: RequestHandler = async (req, res) => {
    await service.changePassword(sessionOf(res).userId, parse(passwordChangeSchema, req.body));
    noContent(res);
  };
  return { list, create, update, changePassword };
}
