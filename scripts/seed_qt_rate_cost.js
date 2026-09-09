#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadRepoEnv } = require('./lib/load-repo-env');
const {
  loadQtRateCostSeed,
  expandRateCards,
  incompleteCards,
  belowMarginFloor,
  tierPricingFromRates,
} = require('./lib/qt-rate-cost-seed');

const ROOT = path.join(__dirname, '..');
loadRepoEnv(ROOT);

const seedPath = path.join(ROOT, 'docs/specs/qt-rate-cost-seed.json');
const mapPath = path.join(ROOT, 'docs/specs/ops-dv01-dv21-route-map.json');
const databaseUrl = process.env.DATABASE_URL;
const pgModulePath = path.join(ROOT, 'services/ptt-crm-api/node_modules/pg');

if (!databaseUrl) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const seed = loadQtRateCostSeed(JSON.parse(fs.readFileSync(seedPath, 'utf8')));
const cards = expandRateCards(seed);
const broken = incompleteCards(cards);
if (broken.length) {
  console.error('Seed cards incomplete', broken);
  process.exit(1);
}
const thin = belowMarginFloor(cards, seed.margin_floor_bps);
if (thin.length) {
  console.error('Seed GM below floor', thin);
  process.exit(1);
}

const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const byDv = new Map((map.services ?? []).map((row) => [String(row.code).toUpperCase(), row]));

async function main() {
  const { Client } = require(pgModulePath);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');

    for (const dv of seed.activate_dv) {
      const entry = byDv.get(dv);
      const slug = String(entry?.service_slugs?.primary ?? dv.toLowerCase());
      const name = String(entry?.name_vi ?? dv);
      const sortOrder = Number(String(dv).replace('DV', '')) || 0;
      await client.query(
        `INSERT INTO crm_catalog_services (slug, name, dv_code, sort_order, active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (slug) DO UPDATE SET
           dv_code = EXCLUDED.dv_code,
           name = EXCLUDED.name,
           active = TRUE,
           updated_at = NOW()`,
        [slug, name, dv, sortOrder],
      );
      await client.query(
        `UPDATE crm_catalog_services
            SET active = TRUE, updated_at = NOW()
          WHERE upper(trim(dv_code)) = $1`,
        [dv],
      );

      const pricing = tierPricingFromRates(seed.rates[dv]);
      await client.query(
        `UPDATE ops_service_profile
            SET tier_pricing = $2::jsonb, updated_at = NOW()
          WHERE upper(trim(dv_code)) = $1`,
        [dv, JSON.stringify(pricing)],
      );

      await client.query(
        `INSERT INTO crm_quote_catalog_revisions (catalog_service_id, profile_json)
         VALUES ($1, $2)`,
        [
          dv,
          JSON.stringify({
            dv_code: dv,
            rate_card: seed.rate_card,
            sku_codes: [`${dv}-CB`, `${dv}-TC`, `${dv}-CS`],
            rates: seed.rates[dv],
            seeded_at: seed.effective_from,
          }),
        ],
      );
    }

    let upserted = 0;
    for (const card of cards) {
      const updated = await client.query(
        `UPDATE crm_quote_rate_cards
            SET fee_vnd = $5,
                cost_labor_vnd = $6,
                effective_to = $7,
                state = 'active'
          WHERE tenant_id = $1
            AND upper(trim(dv_code)) = $2
            AND lower(trim(package_tier)) = $3
            AND effective_from = $4::date
          RETURNING id`,
        [
          seed.tenant_id,
          card.dv_code,
          card.package_tier,
          card.effective_from,
          card.fee_vnd,
          card.cost_labor_vnd,
          card.effective_to,
        ],
      );
      let rateId = updated.rows[0]?.id;
      if (!rateId) {
        const inserted = await client.query(
          `INSERT INTO crm_quote_rate_cards (
             tenant_id, dv_code, package_tier, fee_vnd, cost_labor_vnd,
             effective_from, effective_to, state
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
           RETURNING id`,
          [
            seed.tenant_id,
            card.dv_code,
            card.package_tier,
            card.fee_vnd,
            card.cost_labor_vnd,
            card.effective_from,
            card.effective_to,
          ],
        );
        rateId = inserted.rows[0]?.id;
      }
      if (!rateId) throw new Error(`rate upsert failed ${card.dv_code} ${card.package_tier}`);

      const cost = await client.query(
        `UPDATE crm_quote_cost_cards
            SET labor_vnd = $2, outsource_vnd = 0, tools_vnd = 0
          WHERE rate_card_id = $1
          RETURNING id`,
        [rateId, card.cost_labor_vnd],
      );
      if (!cost.rows[0]) {
        await client.query(
          `INSERT INTO crm_quote_cost_cards (rate_card_id, labor_vnd, outsource_vnd, tools_vnd)
           VALUES ($1, $2, 0, 0)`,
          [rateId, card.cost_labor_vnd],
        );
      }
      upserted += 1;
    }

    await client.query('COMMIT');
    console.log(
      `OK  QT rate/cost seed ${seed.rate_card}: ${seed.activate_dv.length} DV · ${upserted} cards`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
