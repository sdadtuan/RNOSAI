#!/usr/bin/env node
'use strict';
/**
 * S6 pilot — seed service_component + service_bundle_item for DV01.
 * Usage: DATABASE_URL=... node scripts/seed_spc_components.js
 */
const { Client } = require('pg');
const { ensureSpcSchema } = require('./lib/spc-pg-bootstrap');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const DV01_COMPONENTS = [
  {
    component_code: 'DV01-C01',
    name_vi: 'Khám phá định vị & moodboard',
    description_vi: 'Workshop định vị, phân tích đối thủ, moodboard hướng thương hiệu',
    deliverable_vi: 'Tài liệu định vị + moodboard',
    pricing_model: { type: 'one_time', min_vnd: 8000000, max_vnd: 12000000 },
    sort_order: 1,
  },
  {
    component_code: 'DV01-C02',
    name_vi: 'Thiết kế Logo',
    description_vi: 'Logo 3 phương án, chỉnh sửa và bàn giao file nguồn',
    deliverable_vi: 'Logo vector + file nguồn',
    pricing_model: { type: 'one_time', min_vnd: 10000000, max_vnd: 15000000 },
    sort_order: 2,
  },
  {
    component_code: 'DV01-C03',
    name_vi: 'Brand Guideline',
    description_vi: 'Bảng màu, typography, tone of voice, quy tắc ứng dụng cơ bản',
    deliverable_vi: 'Brand guideline PDF',
    pricing_model: { type: 'one_time', min_vnd: 12000000, max_vnd: 18000000 },
    sort_order: 3,
  },
  {
    component_code: 'DV01-C04',
    name_vi: 'Ứng dụng nhận diện',
    description_vi: 'Namecard, POSM, bao bì, ấn phẩm theo gói',
    deliverable_vi: 'Bộ ứng dụng nhận diện',
    pricing_model: { type: 'one_time', min_vnd: 5000000, max_vnd: 25000000 },
    sort_order: 4,
  },
];

const BUNDLES = {
  'DV01-CB': ['DV01-C02', 'DV01-C03'],
  'DV01-TC': ['DV01-C01', 'DV01-C02', 'DV01-C03', 'DV01-C04'],
  'DV01-CS': ['DV01-C01', 'DV01-C02', 'DV01-C03', 'DV01-C04'],
};

async function upsertComponent(client, row) {
  await client.query(
    `INSERT INTO service_component
       (component_code, dv_code, name_vi, description_vi, deliverable_vi, pricing_model, sort_order)
     VALUES ($1,'DV01',$2,$3,$4,$5::jsonb,$6)
     ON CONFLICT (component_code) DO UPDATE SET
       name_vi=EXCLUDED.name_vi, description_vi=EXCLUDED.description_vi,
       deliverable_vi=EXCLUDED.deliverable_vi, pricing_model=EXCLUDED.pricing_model,
       sort_order=EXCLUDED.sort_order, active=TRUE, updated_at=NOW()`,
    [
      row.component_code,
      row.name_vi,
      row.description_vi,
      row.deliverable_vi,
      JSON.stringify(row.pricing_model),
      row.sort_order,
    ],
  );
}

async function syncBundle(client, skuCode, componentCodes) {
  await client.query(`DELETE FROM service_bundle_item WHERE sku_code = $1`, [skuCode]);
  let i = 0;
  for (const code of componentCodes) {
    i += 1;
    await client.query(
      `INSERT INTO service_bundle_item (sku_code, component_code, included, qty, sort_order)
       VALUES ($1,$2,TRUE,1,$3)
       ON CONFLICT (sku_code, component_code) DO UPDATE SET included=TRUE, qty=1, sort_order=EXCLUDED.sort_order`,
      [skuCode, code, i],
    );
  }
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await ensureSpcSchema(client);

  for (const row of DV01_COMPONENTS) await upsertComponent(client, row);
  for (const [sku, codes] of Object.entries(BUNDLES)) await syncBundle(client, sku, codes);

  const count = await client.query(
    `SELECT COUNT(*)::int AS c FROM service_component WHERE dv_code='DV01' AND active=TRUE`,
  );
  const bundleCount = await client.query(
    `SELECT COUNT(*)::int AS c FROM service_bundle_item WHERE sku_code LIKE 'DV01-%'`,
  );
  console.log('OK seed_spc_components', {
    dv01_components: count.rows[0].c,
    dv01_bundle_items: bundleCount.rows[0].c,
  });
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
