import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';

const SQL_BASENAME = '01_portal_meta_insights.sql';

let sqlCache: string | null = null;
let ensurePromise: Promise<void> | null = null;
let applied = false;

export function portalMetaInsightsSqlPath(): string {
  return join(__dirname, 'sql', SQL_BASENAME);
}

export function loadPortalMetaInsightsSql(): string {
  if (!sqlCache) {
    sqlCache = readFileSync(portalMetaInsightsSqlPath(), 'utf8');
  }
  return sqlCache;
}

export async function ensurePortalMetaInsightsSchema(db: Pool, log: Logger, caller: string): Promise<void> {
  if (applied) {
    log.debug(`[portal-meta-insights-ddl] schema already applied; no-op (caller=${caller})`);
    return;
  }
  if (!ensurePromise) {
    log.log(`[portal-meta-insights-ddl] applying ${SQL_BASENAME} (caller=${caller})`);
    const sql = loadPortalMetaInsightsSql();
    ensurePromise = db
      .query(sql)
      .then(() => {
        applied = true;
        log.log(`[portal-meta-insights-ddl] ${SQL_BASENAME} applied OK`);
      })
      .catch((err: unknown) => {
        ensurePromise = null;
        log.error(`[portal-meta-insights-ddl] ${SQL_BASENAME} failed (caller=${caller})`, err);
        throw err;
      });
  } else {
    log.debug(`[portal-meta-insights-ddl] waiting for in-flight ${SQL_BASENAME} (caller=${caller})`);
  }
  await ensurePromise;
}
