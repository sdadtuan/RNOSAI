import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';

const SQL_BASENAME = '00_portal_crm_local.sql';

let sqlCache: string | null = null;
let ensurePromise: Promise<void> | null = null;
let applied = false;

export function portalCrmLocalSqlPath(): string {
  return join(__dirname, 'sql', SQL_BASENAME);
}

export function loadPortalCrmLocalSql(): string {
  if (!sqlCache) {
    sqlCache = readFileSync(portalCrmLocalSqlPath(), 'utf8');
  }
  return sqlCache;
}

/** Idempotent portal CRM schema — single in-process run; further callers await the same promise. */
export async function ensurePortalCrmLocalSchema(db: Pool, log: Logger, caller: string): Promise<void> {
  if (applied) {
    log.debug(`[portal-crm-ddl] schema already applied; no-op (caller=${caller})`);
    return;
  }
  if (!ensurePromise) {
    log.log(`[portal-crm-ddl] applying ${SQL_BASENAME} (caller=${caller})`);
    const sql = loadPortalCrmLocalSql();
    ensurePromise = db
      .query(sql)
      .then(() => {
        applied = true;
        log.log(`[portal-crm-ddl] ${SQL_BASENAME} applied OK`);
      })
      .catch((err: unknown) => {
        ensurePromise = null;
        log.error(`[portal-crm-ddl] ${SQL_BASENAME} failed (caller=${caller})`, err);
        throw err;
      });
  } else {
    log.debug(`[portal-crm-ddl] waiting for in-flight ${SQL_BASENAME} (caller=${caller})`);
  }
  await ensurePromise;
}
