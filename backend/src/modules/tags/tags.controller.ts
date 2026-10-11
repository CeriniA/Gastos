import type { RequestHandler } from 'express';
import { idParamsSchema, tagInputSchema } from '@gastos/shared';
import { noContent, ok, parse } from '../../core/http/http';
import type { TagsService } from './tags.service';

export function createTagsController(service: TagsService) {
  const list: RequestHandler = async (_req, res) => {
    ok(res, await service.list());
  };
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(tagInputSchema, req.body)), 201);
  };
  const rename: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.rename(id, parse(tagInputSchema, req.body)));
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  return { list, create, rename, remove };
}
