import { json, urlencoded, type Request } from 'express';
import type { INestApplication } from '@nestjs/common';

export const DEFAULT_JSON_LIMIT = '100kb';
export const P13_CATALOG_IMPORT_JSON_LIMIT = '5mb';
export const P13_CATALOG_IMPORT_PATH = '/api/crm/p13/catalog-import';

function keepRawBody(req: Request, _res: unknown, buffer: Buffer): void {
  if (Buffer.isBuffer(buffer) && buffer.length) req.rawBody = buffer;
}

/** Default JSON stays 100kb. Only the catalog import route accepts a larger body. */
export function mountJsonBody(app: INestApplication): void {
  app.use(P13_CATALOG_IMPORT_PATH, json({ limit: P13_CATALOG_IMPORT_JSON_LIMIT, verify: keepRawBody }));
  app.use(json({ limit: DEFAULT_JSON_LIMIT, verify: keepRawBody }));
  app.use(urlencoded({ extended: true, limit: DEFAULT_JSON_LIMIT }));
}
