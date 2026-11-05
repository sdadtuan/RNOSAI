import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Pool } from 'pg';

/** Serializes catalog ensureSchema and quote ready() so two ALTER TABLE runs cannot deadlock. */
export const P13_SCHEMA_LOCK = 13050305;

const FILES = [
  '2026-10-02-p13-01-service-catalog.sql',
  '2026-10-02-p13-02-holidays.sql',
  '2026-10-02-p13-04-pricing.sql',
  '2026-10-03-p13-05-quotes.sql',
];

export function readP13Sql(name: string): string {
  const candidates = [
    join(process.cwd(), 'docs/specs', name),
    join(process.cwd(), '../../docs/specs', name),
    join(__dirname, '../../../../../docs/specs', name),
    join(__dirname, '../../../../docs/specs', name),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  throw new Error(`missing SQL ${name}`);
}

export function p13SchemaSql(): string {
  return FILES.map((name) => readP13Sql(name)).join('\n');
}

export async function withP13SchemaLock(pool: Pool, sql: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [P13_SCHEMA_LOCK]);
    await client.query(sql);
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [P13_SCHEMA_LOCK]);
    } catch {
      // The session lock ends when this pooled connection is discarded.
    }
    client.release();
  }
}
