import type { RequestHandler } from 'express';
import { categoryReportQuerySchema } from '@gastos/shared';
import { asUser, ok, parse } from '../../core/http/http';
import type { ReportsService } from './reports.service';

export function createReportsController(service: ReportsService) {
  const byCategory: RequestHandler = async (req, res) => {
    ok(res, await service.byCategory(parse(categoryReportQuerySchema, req.query).month));
  };
  return asUser({ byCategory });
}
