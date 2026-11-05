import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import type { INestApplication } from '@nestjs/common';

export const DEFAULT_JSON_LIMIT = '100kb';
export const P13_CATALOG_IMPORT_JSON_LIMIT = '5mb';
export const P13_CATALOG_IMPORT_PATH = '/api/crm/p13/catalog-import';
/** Solution desk stores up to 5 files × 1.5MB as data URLs inside this PATCH. */
export const MARKETING_PLAN_JSON_LIMIT = '12mb';
const MARKETING_PLAN_PATCH = /^\/api\/v1\/leads\/\d+\/presales\/marketing-plan\/?$/;

function keepRawBody(req: Request, _res: unknown, buffer: Buffer): void {
  if (Buffer.isBuffer(buffer) && buffer.length) req.rawBody = buffer;
}

function isMarketingPlanPatch(req: Request): boolean {
  return req.method === 'PATCH' && MARKETING_PLAN_PATCH.test(req.path);
}

/** Default JSON stays 100kb. Catalog import and Solution file saves accept a larger body. */
export function mountJsonBody(app: INestApplication): void {
  const planJson = json({ limit: MARKETING_PLAN_JSON_LIMIT, verify: keepRawBody });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isMarketingPlanPatch(req)) return next();
    return planJson(req, res, next);
  });
  app.use(P13_CATALOG_IMPORT_PATH, json({ limit: P13_CATALOG_IMPORT_JSON_LIMIT, verify: keepRawBody }));
  app.use(json({ limit: DEFAULT_JSON_LIMIT, verify: keepRawBody }));
  app.use(urlencoded({ extended: true, limit: DEFAULT_JSON_LIMIT }));
}
