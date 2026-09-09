'use strict';

const TIERS = ['basic', 'standard', 'premium'];

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function loadQtRateCostSeed(doc) {
  const seed = asObject(doc);
  const activate = Array.isArray(seed.activate_dv)
    ? seed.activate_dv.map((code) => String(code).trim().toUpperCase()).filter(Boolean)
    : [];
  const rates = asObject(seed.rates);
  return {
    schema_version: String(seed.schema_version ?? ''),
    rate_card: String(seed.rate_card ?? 'HCM 2026'),
    tenant_id: String(seed.tenant_id ?? 'PTT'),
    effective_from: String(seed.effective_from ?? '').slice(0, 10),
    effective_to: seed.effective_to ? String(seed.effective_to).slice(0, 10) : null,
    margin_floor_bps: Number(seed.margin_floor_bps ?? 2500),
    activate_dv: activate,
    rates,
  };
}

function expandRateCards(seed) {
  const cards = [];
  for (const dv of seed.activate_dv) {
    const byTier = asObject(seed.rates[dv]);
    for (const tier of TIERS) {
      const row = asObject(byTier[tier]);
      const fee = Number(row.fee_vnd);
      const cost = row.cost_labor_vnd == null || row.cost_labor_vnd === '' ? null : Number(row.cost_labor_vnd);
      cards.push({
        dv_code: dv,
        package_tier: tier,
        fee_vnd: fee,
        cost_labor_vnd: Number.isFinite(cost) ? cost : null,
        effective_from: seed.effective_from,
        effective_to: seed.effective_to,
        state: 'active',
      });
    }
  }
  return cards;
}

function packageDvCodes(packages) {
  const codes = new Set();
  for (const pkg of packages ?? []) {
    for (const line of pkg.lines ?? []) {
      const dv = String(line.dv_code ?? '').trim().toUpperCase();
      if (dv) codes.add(dv);
    }
  }
  return [...codes].sort();
}

function missingSeedDv(seed, required) {
  const have = new Set(seed.activate_dv);
  return required.filter((dv) => !have.has(dv));
}

function incompleteCards(cards) {
  return cards.filter(
    (card) =>
      !card.dv_code ||
      !TIERS.includes(card.package_tier) ||
      !Number.isSafeInteger(card.fee_vnd) ||
      card.fee_vnd <= 0 ||
      card.cost_labor_vnd == null ||
      !Number.isSafeInteger(card.cost_labor_vnd) ||
      card.cost_labor_vnd < 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(card.effective_from),
  );
}

function marginBps(card) {
  if (!card.fee_vnd) return 0;
  return Math.round(((card.fee_vnd - (card.cost_labor_vnd ?? 0)) / card.fee_vnd) * 10000);
}

function belowMarginFloor(cards, floorBps) {
  return cards.filter((card) => marginBps(card) < floorBps);
}

function tierPricingFromRates(byTier) {
  const out = {};
  for (const tier of TIERS) {
    const fee = Number(asObject(byTier[tier]).fee_vnd);
    if (!Number.isSafeInteger(fee) || fee <= 0) continue;
    out[tier] = {
      price_vnd: fee,
      min_vnd: Math.round(fee * 0.85),
      max_vnd: Math.round(fee * 1.15),
    };
  }
  return out;
}

module.exports = {
  TIERS,
  loadQtRateCostSeed,
  expandRateCards,
  packageDvCodes,
  missingSeedDv,
  incompleteCards,
  marginBps,
  belowMarginFloor,
  tierPricingFromRates,
};
