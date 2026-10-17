import type { RequestHandler } from 'express';
import {
  categoryReportQuerySchema,
  evolutionQuerySchema,
  monthReportQuerySchema,
  projectionQuerySchema,
} from '@gastos/shared';
import { asUser, ok, parse } from '../../core/http/http';
import type { ReportsService } from './reports.service';

export function createReportsController(service: ReportsService) {
  const byCategory: RequestHandler = async (req, res) => {
    const query = parse(categoryReportQuerySchema, req.query);
    ok(res, await service.byCategory(query.month, query.in));
  };
  const byAccount: RequestHandler = async (req, res) => {
    const query = parse(monthReportQuerySchema, req.query);
    ok(res, await service.byAccount(query.month, query.in));
  };
  const byMerchant: RequestHandler = async (req, res) => {
    const query = parse(monthReportQuerySchema, req.query);
    ok(res, await service.byMerchant(query.month, query.in));
  };
  const evolution: RequestHandler = async (req, res) => {
    const query = parse(evolutionQuerySchema, req.query);
    ok(res, await service.evolution(query.to, query.months, query.in));
  };
  const projection: RequestHandler = async (req, res) => {
    ok(res, await service.projection(parse(projectionQuerySchema, req.query).in));
  };
  return asUser({ byCategory, byAccount, byMerchant, evolution, projection });
}
