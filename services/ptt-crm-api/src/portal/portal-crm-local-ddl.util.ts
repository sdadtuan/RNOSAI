import { Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';

const SQL_FILES = ['00_portal_crm_local.sql', '02_portal_inbox_pancake.sql', '03_portal_inbox_comments.sql', '04_portal_pos.sql'];

let ensurePromise: Promise<void> | null = null;
let applied = false;

export function portalCrmLocalSqlPath(basename = '00_portal_crm_local.sql'): string {
  return join(__dirname, 'sql', basename);
}

export function loadPortalCrmLocalSql(basename = '00_portal_crm_local.sql'): string {
  return readFileSync(portalCrmLocalSqlPath(basename), 'utf8');
}

/** Idempotent portal CRM schema — single in-process run; further callers await the same promise. */
export async function ensurePortalCrmLocalSchema(db: Pool, log: Logger, caller: string): Promise<void> {
  if (applied) {
    log.debug(`[portal-crm-ddl] schema already applied; no-op (caller=${caller})`);
    return;
  }
  if (!ensurePromise) {
    log.log(`[portal-crm-ddl] applying ${SQL_FILES.join(', ')} (caller=${caller})`);
    ensurePromise = (async () => {
      for (const file of SQL_FILES) {
        const path = portalCrmLocalSqlPath(file);
        if (!existsSync(path)) {
          log.warn(`[portal-crm-ddl] ${file} not found at ${path}; skipped`);
          continue;
        }
        const sql = readFileSync(path, 'utf8');
        await db.query(sql);
        log.log(`[portal-crm-ddl] ${file} applied OK`);
      }
      applied = true;
    })().catch((err: unknown) => {
      ensurePromise = null;
      log.error(`[portal-crm-ddl] schema apply failed (caller=${caller})`, err);
      throw err;
    });
  } else {
    log.debug(`[portal-crm-ddl] waiting for in-flight schema apply (caller=${caller})`);
  }
  await ensurePromise;
}
