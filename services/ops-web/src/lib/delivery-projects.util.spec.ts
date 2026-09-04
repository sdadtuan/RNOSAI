import { describe, expect, it } from 'vitest';
import {
  deriveDeliveryHealth,
  hasCircularMilestoneDeps,
  normalizeCapabilities,
  nextPrjCode,
} from './delivery-projects.util';

describe('normalizeCapabilities', () => {
  it('dedupes and drops unknown', () => {
    expect(normalizeCapabilities(['delivery', 'lead_ingest', 'delivery', 'x'])).toEqual([
      'lead_ingest',
      'delivery',
    ]);
    expect(normalizeCapabilities([])).toEqual([]);
  });
});

describe('nextPrjCode', () => {
  it('increments the max PRJ number', () => {
    expect(nextPrjCode([])).toBe('PRJ-001');
    expect(nextPrjCode(['PRJ-001', 'PTT-LEGACY', 'PRJ-025'])).toBe('PRJ-026');
  });
});

describe('hasCircularMilestoneDeps', () => {
  it('detects a cycle', () => {
    expect(hasCircularMilestoneDeps([{ from: 'M1', to: 'M2' }, { from: 'M2', to: 'M1' }])).toBe(true);
    expect(hasCircularMilestoneDeps([{ from: 'M1', to: 'M2' }, { from: 'M2', to: 'M3' }])).toBe(false);
  });
});

describe('deriveDeliveryHealth', () => {
  it('lead-only uses ingest status', () => {
    expect(
      deriveDeliveryHealth({
        capabilities: ['lead_ingest'],
        ingestStatus: 'active',
        todayIso: '2026-09-04',
        milestones: [],
      }).health,
    ).toBe('stable');
    expect(
      deriveDeliveryHealth({
        capabilities: ['lead_ingest'],
        ingestStatus: 'paused',
        todayIso: '2026-09-04',
        milestones: [],
      }).health,
    ).toBe('needs_attention');
  });

  it('delivery overdue when a planned milestone is past due', () => {
    const out = deriveDeliveryHealth({
      capabilities: ['delivery'],
      todayIso: '2026-09-04',
      milestones: [{ due_date: '2026-09-01', status: 'planned' }],
    });
    expect(out.health).toBe('overdue');
  });

  it('delivery no_data without milestones', () => {
    expect(
      deriveDeliveryHealth({
        capabilities: ['delivery'],
        todayIso: '2026-09-04',
        milestones: [],
      }).health,
    ).toBe('no_data');
  });
});
