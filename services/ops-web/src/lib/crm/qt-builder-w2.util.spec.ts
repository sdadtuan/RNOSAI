import { describe, expect, it } from 'vitest';
import { dash } from './qt-format';
import {
  QT_KPI_CLASSES,
  funnelFromProjectedKpis,
  isProjectedResult,
} from './qt-builder-w2.util';

describe('KPI classes', () => {
  it('locks the four official classes', () => {
    expect([...QT_KPI_CLASSES]).toEqual([
      'committed',
      'optimization_target',
      'projected_result',
      'assumption_input',
    ]);
  });

  it('recognizes projected_result only', () => {
    expect(isProjectedResult({ class: 'projected_result' })).toBe(true);
    expect(isProjectedResult({ class: 'Projected_Result' })).toBe(true);
    expect(isProjectedResult({ class: 'committed' })).toBe(false);
    expect(isProjectedResult({ class: 'optimization_target' })).toBe(false);
    expect(isProjectedResult({ class: 'assumption_input' })).toBe(false);
  });
});

describe('funnelFromProjectedKpis', () => {
  it('reads Imp/Click/Lead/SQL/CTR only from projected_result rows', () => {
    const funnel = funnelFromProjectedKpis([
      { name: 'Imp.', value_text: '2,4tr', class: 'projected_result' },
      { name: 'Click', value_text: '43K', class: 'projected_result' },
      { name: 'Lead', value_text: '1.5K', class: 'projected_result' },
      { name: 'SQL', value_text: '1.2K', class: 'projected_result' },
      { name: 'CTR', value_text: '1,8%', class: 'projected_result' },
      { name: 'CTR', value_text: '9,9%', class: 'optimization_target' },
      { name: 'CPL', value_text: '100K', class: 'assumption_input' },
    ]);

    expect(funnel.impressions).toBe('2,4tr');
    expect(funnel.clicks).toBe('43K');
    expect(funnel.leads).toBe('1.5K');
    expect(funnel.sql).toBe('1.2K');
    expect(funnel.ctr).toBe('1,8%');
    expect(funnel.cpl).toBeNull();
  });

  it('never invents CTR from clicks and impressions', () => {
    const funnel = funnelFromProjectedKpis([
      { name: 'Impressions', value_text: '10000', class: 'projected_result' },
      { name: 'Clicks', value_text: '200', class: 'projected_result' },
    ]);

    expect(funnel.impressions).toBe('10000');
    expect(funnel.clicks).toBe('200');
    expect(funnel.ctr).toBeNull();
    expect(funnel.cvr).toBeNull();
    expect(funnel.cpl).toBeNull();
  });

  it('returns nulls when empty so UI can dash', () => {
    const funnel = funnelFromProjectedKpis([]);
    expect(funnel.impressions).toBeNull();
    expect(funnel.clicks).toBeNull();
    expect(funnel.leads).toBeNull();
    expect(funnel.sql).toBeNull();
    expect(funnel.ctr).toBeNull();
    expect(dash(funnel.ctr)).toBe('—');
  });
});
