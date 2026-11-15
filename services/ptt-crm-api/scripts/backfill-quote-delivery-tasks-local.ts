import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import {
  ensureContractSignedAt,
  listTrienKhaiLeadsForTaskBackfill,
  seedQuoteDeliveryTasks,
} from '../src/leads-contract/quote-delivery-tasks-pg.util';

function loadDotEnvFile(): void {
  const path = join(__dirname, '..', '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function assertLocalDatabaseUrl(raw: string): void {
  let host = '';
  try {
    host = new URL(raw.replace(/^postgres(ql)?:/i, 'http:')).hostname.toLowerCase();
  } catch {
    throw new Error('refuse: database URL is not local');
  }
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('refuse: not local');
  }
}

async function main(): Promise<void> {
  loadDotEnvFile();
  const dbUrl = String(process.env.DATABASE_URL || process.env.PTT_DATABASE_URL || '').trim();
  if (!dbUrl) {
    process.stderr.write('DATABASE_URL / PTT_DATABASE_URL missing\n');
    process.exit(1);
  }
  assertLocalDatabaseUrl(dbUrl);

  const pool = new Pool({ connectionString: dbUrl });
  const startedAt = new Date();
  let signedAtStamped = 0;
  let inserted = 0;
  let skipped = 0;
  let candidates = 0;
  let leads = 0;
  let errors = 0;
  try {
    const rows = await listTrienKhaiLeadsForTaskBackfill(pool);
    leads = rows.length;
    process.stdout.write(`trien_khai leads: ${leads}\n`);
    for (const row of rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (await ensureContractSignedAt(client, row.presales_id, startedAt)) {
          signedAtStamped += 1;
        }
        const result = await seedQuoteDeliveryTasks(client, {
          leadId: row.lead_id,
          lifecycleId: row.lifecycle_id,
          presalesId: row.presales_id,
          assignedAm: row.assigned_am,
          startedAt: startedAt.toISOString(),
        });
        inserted += result.inserted;
        skipped += result.skipped;
        candidates += result.total_candidates;
        await client.query('COMMIT');
        process.stdout.write(
          `lead ${row.lead_id}: inserted=${result.inserted} skipped=${result.skipped} candidates=${result.total_candidates}\n`,
        );
      } catch (err) {
        await client.query('ROLLBACK');
        errors += 1;
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`lead ${row.lead_id}: ${message}\n`);
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }

  process.stdout.write(
    `done: leads=${leads} signed_at_stamped=${signedAtStamped} inserted=${inserted} skipped=${skipped} candidates=${candidates} errors=${errors}\n`,
  );
  if (errors > 0) process.exitCode = 1;
}

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
