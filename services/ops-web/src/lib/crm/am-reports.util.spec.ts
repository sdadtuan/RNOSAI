import { describe, expect, it } from 'vitest';
import {
  AM_REPORT_EXPORT_TOOLTIP,
  AM_REPORT_FORMULAS,
  amReportsDrillHref,
  amReportsFormatRate,
  amReportsHideNrrNote,
} from './am-reports.util';

describe('am-reports.util', () => {
  it('returns Vietnamese hide-NRR copy when expansion is unclassified', () => {
    const note = amReportsHideNrrNote();
    expect(note).toMatch(/expansion/i);
    expect(note).toMatch(/ẩn/);
    expect(note).toMatch(/Logo/);
  });

  it('builds account-list drill href with report filter', () => {
    expect(
      amReportsDrillHref({
        report: 'logo',
        from: '2026-01-01',
        to: '2026-09-05',
        scope: 'me',
      }),
    ).toBe('/crm/account-management/clients?from=2026-01-01&to=2026-09-05&scope=me&report=logo');
  });

  it('formats rate as percent or em dash', () => {
    expect(amReportsFormatRate(0.85)).toBe('85%');
    expect(amReportsFormatRate(1.05)).toBe('105%');
    expect(amReportsFormatRate(0.9)).toBe('90%');
    expect(amReportsFormatRate(null)).toBe('—');
    expect(amReportsFormatRate(undefined)).toBe('—');
  });

  it('exposes plan formula strings and the disabled export tooltip', () => {
    expect(AM_REPORT_FORMULAS.logo).toBe(
      'Logo = remaining_end / start_set          (new logos excluded from denominator)',
    );
    expect(AM_REPORT_FORMULAS.grr).toBe('GRR  = (Start − Churn − Contraction) / Start');
    expect(AM_REPORT_FORMULAS.nrr).toBe('NRR  = (Start − Churn − Contraction + Expansion) / Start');
    expect(AM_REPORT_EXPORT_TOOLTIP).toBe('Export >10k sẽ làm bất đồng bộ — chưa mở');
  });
});
