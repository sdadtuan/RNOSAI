#!/usr/bin/env ts-node
/**
 * Import shipped disk playbooks into mkt_ai_playbook_versions (active, depth=shipped).
 *
 * Reads _common.json + 3 industry JSON from playbooks/, inserts version_no=1 when no
 * active exists (skips insert if active already present), links policy.active_version_id
 * for 3 pilot slugs + _common (rollout=ga).
 *
 * Usage (from repo root; pg lives in services/ptt-crm-api):
 *   cd services/ptt-crm-api && NODE_PATH=./node_modules npx tsx ../../scripts/seed_mkt_ai_playbook_versions.ts
 *   DATABASE_URL=... NODE_PATH=./node_modules npx tsx ../../scripts/seed_mkt_ai_playbook_versions.ts --dry-run
 */
import * as fs from 'fs';
import * as path from 'path';
import { Pool, PoolClient } from 'pg';

const CREATED_BY = 'seed_mkt_ai_playbook_versions';

type PlaybookSource = 'disk' | 'common';

type PlaybookSeed = {
  file: string;
  serviceSlug: string;
  source: PlaybookSource;
};

const PLAYBOOK_SEEDS: PlaybookSeed[] = [
  { file: '_common.json', serviceSlug: '_common', source: 'common' },
  { file: 'meta-lead-gen.json', serviceSlug: 'meta-lead-gen', source: 'disk' },
  { file: 'bds-lead-gen.json', serviceSlug: 'bds-lead-gen', source: 'disk' },
  { file: 'seo-retainer.json', serviceSlug: 'seo-retainer', source: 'disk' },
];

const PILOT_SLUGS = ['meta-lead-gen', 'bds-lead-gen', 'seo-retainer'] as const;

function repoRoot(): string {
  return path.resolve(__dirname, '..');
}

function playbooksDir(): string {
  return path.join(
    repoRoot(),
    'services/ptt-crm-api/src/marketing-ai-planner/playbooks',
  );
}

function readPlaybookDocument(fileName: string): Record<string, unknown> {
  const filePath = path.join(playbooksDir(), fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing playbook file: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const doc = JSON.parse(raw) as Record<string, unknown>;
  const slug = String(doc.slug ?? '').trim();
  const base = path.basename(fileName, '.json');
  if (slug !== base) {
    throw new Error(`Playbook slug "${slug}" must match filename "${base}.json"`);
  }
  return doc;
}

async function findActiveVersionId(
  client: PoolClient,
  serviceSlug: string,
): Promise<number | null> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM mkt_ai_playbook_versions
     WHERE service_slug = $1 AND status = 'active'
     LIMIT 1`,
    [serviceSlug],
  );
  return rows[0] ? Number(rows[0].id) : null;
}

async function nextVersionNo(client: PoolClient, serviceSlug: string): Promise<number> {
  const { rows } = await client.query<{ next_no: string }>(
    `SELECT COALESCE(MAX(version_no), 0) + 1 AS next_no
     FROM mkt_ai_playbook_versions
     WHERE service_slug = $1`,
    [serviceSlug],
  );
  return Number(rows[0]?.next_no ?? 1);
}

async function ensureActiveVersion(
  client: PoolClient,
  seed: PlaybookSeed,
  dryRun: boolean,
): Promise<{ id: number; inserted: boolean }> {
  const existingId = await findActiveVersionId(client, seed.serviceSlug);
  if (existingId != null) {
    console.log(`skip  ${seed.serviceSlug}: active version id=${existingId} already exists`);
    return { id: existingId, inserted: false };
  }

  const document = readPlaybookDocument(seed.file);
  const versionNo = await nextVersionNo(client, seed.serviceSlug);
  if (dryRun) {
    console.log(
      `dry    ${seed.serviceSlug}: would insert v${versionNo} active shipped source=${seed.source}`,
    );
    return { id: -1, inserted: true };
  }

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO mkt_ai_playbook_versions (
       service_slug, version_no, status, depth, document_json, source, created_by
     ) VALUES ($1, $2, 'active', 'shipped', $3::jsonb, $4, $5)
     RETURNING id`,
    [seed.serviceSlug, versionNo, JSON.stringify(document), seed.source, CREATED_BY],
  );
  const id = Number(rows[0].id);
  console.log(`insert ${seed.serviceSlug}: active v${versionNo} id=${id} source=${seed.source}`);
  return { id, inserted: true };
}

async function upsertCommonPolicy(
  client: PoolClient,
  activeVersionId: number,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) {
    console.log(`dry    _common policy: rollout=ga enabled=true active_version_id=${activeVersionId}`);
    return;
  }
  await client.query(
    `INSERT INTO mkt_ai_service_policy (service_slug, rollout, enabled, active_version_id, updated_by)
     VALUES ('_common', 'ga', TRUE, $1, $2)
     ON CONFLICT (service_slug) DO UPDATE SET
       rollout = 'ga',
       enabled = TRUE,
       active_version_id = EXCLUDED.active_version_id,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by`,
    [activeVersionId, CREATED_BY],
  );
  console.log(`policy _common: rollout=ga active_version_id=${activeVersionId}`);
}

async function linkPilotPolicies(
  client: PoolClient,
  versionIds: Record<string, number>,
  dryRun: boolean,
): Promise<void> {
  for (const slug of PILOT_SLUGS) {
    const versionId = versionIds[slug];
    if (versionId == null || versionId < 0) {
      console.warn(`warn   ${slug}: no active version id — skip policy link`);
      continue;
    }
    if (dryRun) {
      console.log(`dry    ${slug} policy: active_version_id=${versionId}`);
      continue;
    }
    const { rowCount } = await client.query(
      `UPDATE mkt_ai_service_policy
       SET active_version_id = $1, updated_at = now(), updated_by = $2
       WHERE service_slug = $3`,
      [versionId, CREATED_BY, slug],
    );
    if ((rowCount ?? 0) === 0) {
      console.warn(`warn   ${slug}: no mkt_ai_service_policy row — run seed_mkt_ai_service_policy.sql first`);
      continue;
    }
    console.log(`policy ${slug}: active_version_id=${versionId}`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const databaseUrl = (
    process.env.DATABASE_URL ??
    process.env.PTT_DATABASE_URL ??
    'postgresql://ptt:ptt_dev@127.0.0.1:5433/rnosaidb'
  ).trim();

  console.log('== seed_mkt_ai_playbook_versions ==');
  console.log(`playbooks=${playbooksDir()}`);
  console.log(`dry_run=${dryRun}`);

  for (const seed of PLAYBOOK_SEEDS) {
    readPlaybookDocument(seed.file);
  }
  console.log(`validated ${PLAYBOOK_SEEDS.length} playbook JSON file(s)`);

  if (dryRun) {
    const pool = new Pool({ connectionString: databaseUrl });
    const client = await pool.connect();
    try {
      const versionIds: Record<string, number> = {};
      for (const seed of PLAYBOOK_SEEDS) {
        const result = await ensureActiveVersion(client, seed, true);
        versionIds[seed.serviceSlug] = result.id;
      }
      const commonId = versionIds._common;
      if (commonId != null) {
        await upsertCommonPolicy(client, commonId, true);
      }
      await linkPilotPolicies(client, versionIds, true);
    } finally {
      client.release();
      await pool.end();
    }
    console.log('Dry-run OK');
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET CONSTRAINTS mkt_ai_service_policy_active_fk DEFERRED');

    const versionIds: Record<string, number> = {};
    for (const seed of PLAYBOOK_SEEDS) {
      const result = await ensureActiveVersion(client, seed, false);
      versionIds[seed.serviceSlug] = result.id;
    }

    const commonId = versionIds._common;
    if (commonId == null || commonId < 0) {
      throw new Error('_common active version id missing after seed');
    }
    await upsertCommonPolicy(client, commonId, false);
    await linkPilotPolicies(client, versionIds, false);

    await client.query('COMMIT');
    console.log('OK  seed_mkt_ai_playbook_versions complete');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
