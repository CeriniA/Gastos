import type { RequestHandler } from 'express';
import { idParamsSchema, tagInputSchema } from '@gastos/shared';
import { asUser, noContent, ok, parse } from '../../core/http/http';
import type { TagsService } from './tags.service';
import { HTTP_STATUS } from '../../core/http/status';

export function createTagsController(service: TagsService) {
  const list: RequestHandler = async (_req, res) => {
    ok(res, await service.list());
  };
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(tagInputSchema, req.body)), HTTP_STATUS.created);
  };
  const rename: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.rename(id, parse(tagInputSchema, req.body)));
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  return asUser({ list, create, rename, remove });
}
