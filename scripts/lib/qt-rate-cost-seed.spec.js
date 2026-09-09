'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  loadQtRateCostSeed,
  expandRateCards,
  packageDvCodes,
  missingSeedDv,
  incompleteCards,
  belowMarginFloor,
  marginBps,
  tierPricingFromRates,
} = require('./qt-rate-cost-seed');

const seedPath = path.join(__dirname, '../../docs/specs/qt-rate-cost-seed.json');
const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const seed = loadQtRateCostSeed(raw);
const cards = expandRateCards(seed);

const packages = [
  { lines: [{ dv_code: 'DV12' }, { dv_code: 'DV04' }, { dv_code: 'DV03' }, { dv_code: 'DV02' }] },
  {
    lines: [
      { dv_code: 'DV12' },
      { dv_code: 'DV04' },
      { dv_code: 'DV03' },
      { dv_code: 'DV15' },
      { dv_code: 'DV08' },
      { dv_code: 'DV13' },
    ],
  },
  { lines: [{ dv_code: 'DV04' }, { dv_code: 'DV02' }, { dv_code: 'DV03' }, { dv_code: 'DV11' }, { dv_code: 'DV06' }] },
  { lines: [{ dv_code: 'DV04' }, { dv_code: 'DV03' }, { dv_code: 'DV08' }, { dv_code: 'DV02' }] },
];

test('seed covers four industry packages plus DV19', () => {
  const required = [...packageDvCodes(packages), 'DV19'];
  assert.deepEqual(missingSeedDv(seed, required), []);
  assert.ok(seed.activate_dv.includes('DV19'));
});

test('every activated DV has 3 tiers with fee + cost', () => {
  assert.equal(cards.length, seed.activate_dv.length * 3);
  assert.deepEqual(incompleteCards(cards), []);
});

test('labor cost keeps GM at or above the 25% floor', () => {
  assert.deepEqual(belowMarginFloor(cards, seed.margin_floor_bps), []);
  const standard = cards.find((card) => card.dv_code === 'DV19' && card.package_tier === 'standard');
  assert.equal(standard.fee_vnd, 18000000);
  assert.ok(marginBps(standard) >= 2500);
});

test('tier pricing snapshot is derived from seed fees', () => {
  const pricing = tierPricingFromRates(seed.rates.DV04);
  assert.equal(pricing.standard.price_vnd, 25000000);
  assert.equal(pricing.standard.min_vnd, 21250000);
});
