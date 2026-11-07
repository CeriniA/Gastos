import type { RequestHandler } from 'express';
import {
  categoryCreateSchema,
  categoryMergeSchema,
  categoryUpdateSchema,
  idParamsSchema,
} from '@gastos/shared';
import { asUser, noContent, ok, parse } from '../../core/http/http';
import type { CategoriesService } from './categories.service';
import { HTTP_STATUS } from '../../core/http/status';

export function createCategoriesController(service: CategoriesService) {
  const list: RequestHandler = async (_req, res) => {
    ok(res, await service.list());
  };
  const create: RequestHandler = async (req, res) => {
    ok(res, await service.create(parse(categoryCreateSchema, req.body)), HTTP_STATUS.created);
  };
  const update: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.update(id, parse(categoryUpdateSchema, req.body)));
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(parse(idParamsSchema, req.params).id);
    noContent(res);
  };
  const merge: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    ok(res, await service.merge(id, parse(categoryMergeSchema, req.body).targetId));
  };
  return asUser({ list, create, update, remove, merge });
}
