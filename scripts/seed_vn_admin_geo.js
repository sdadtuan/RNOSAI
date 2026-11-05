#!/usr/bin/env node
/**
 * Fetch & seed all VN provinces + wards (post-2025, 2-level).
 * Source: open-admin-data/vietnam-administrative-divisions (CC-BY-4.0)
 *
 * Usage:
 *   DATABASE_URL=... node scripts/seed_vn_admin_geo.js
 *   DATABASE_URL=... node scripts/seed_vn_admin_geo.js --dry-run
 */
'use strict';

const { Pool } = require('pg');

const PROVINCE_URL =
  'https://raw.githubusercontent.com/open-admin-data/vietnam-administrative-divisions/main/data/all-province.json';
const WARD_URL =
  'https://raw.githubusercontent.com/open-admin-data/vietnam-administrative-divisions/main/data/all-ward.json';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${url}: ${res.status}`);
  return res.json();
}

function wardDisplayName(row) {
  const local = String(row?.name?.local ?? '').trim();
  const level = String(row?.level_name?.local ?? '').trim();
  if (!local) return '';
  if (level && !local.toLowerCase().startsWith('phường') && !local.toLowerCase().startsWith('xã')) {
    const prefix = level.includes('/') ? 'Phường/Xã' : level;
    return `${prefix} ${local}`;
  }
  return local;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  console.log('== Fetch VN provinces/wards from open-admin-data ==');
  const [provincesRaw, wardsRaw] = await Promise.all([fetchJson(PROVINCE_URL), fetchJson(WARD_URL)]);

  const provinces = provincesRaw
    .map((p, idx) => ({
      code: String(p.id ?? p.code?.id ?? '').trim(),
      name: String(p.name?.local ?? '').trim(),
      name_en: String(p.name?.en ?? '').trim(),
      sort_order: idx,
    }))
    .filter((p) => p.code && p.name);

  const wards = wardsRaw
    .map((w, idx) => ({
      code: String(w.id ?? w.code?.id ?? '').trim(),
      province_code: String(w.parent?.id ?? '').trim(),
      name: wardDisplayName(w),
      name_en: String(w.name?.en ?? '').trim(),
      sort_order: idx,
    }))
    .filter((w) => w.code && w.province_code && w.name);

  console.log(`Provinces: ${provinces.length}, Wards: ${wards.length}`);

  if (dryRun) {
    console.log('Dry-run OK');
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of provinces) {
      await client.query(
        `INSERT INTO vn_provinces (code, name, name_en, sort_order, active, source, updated_at)
         VALUES ($1, $2, $3, $4, TRUE, 'open-admin-data', now())
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           name_en = EXCLUDED.name_en,
           sort_order = EXCLUDED.sort_order,
           source = EXCLUDED.source,
           updated_at = now()`,
        [p.code, p.name, p.name_en, p.sort_order],
      );
    }
    for (const w of wards) {
      await client.query(
        `INSERT INTO vn_wards (code, province_code, name, name_en, sort_order, active, source, updated_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, 'open-admin-data', now())
         ON CONFLICT (code) DO UPDATE SET
           province_code = EXCLUDED.province_code,
           name = EXCLUDED.name,
           name_en = EXCLUDED.name_en,
           sort_order = EXCLUDED.sort_order,
           source = EXCLUDED.source,
           updated_at = now()`,
        [w.code, w.province_code, w.name, w.name_en, w.sort_order],
      );
    }
    await client.query('COMMIT');
    const counts = await client.query(
      `SELECT (SELECT count(*)::int FROM vn_provinces) AS provinces,
              (SELECT count(*)::int FROM vn_wards) AS wards`,
    );
    console.log(`OK  seeded provinces=${counts.rows[0].provinces} wards=${counts.rows[0].wards}`);
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
