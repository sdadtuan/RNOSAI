import { describe, expect, it } from 'vitest';
import {
  clampProgress,
  formatViYmd,
  iwrKpiItemSeed,
  iwrKpiProgress,
  iwrKpiScore,
  iwrNormalizeEvidenceUrl,
  iwrTaskTitleInput,
  iwrTitleForKpi,
  iwrVisibleEvidenceUrl,
  kpiDelta,
  isOverdueYmd,
  parseIwrItemMeta,
  serializeIwrItemMeta,
} from './iwr-item-meta';

describe('daily task fields', () => {
  it('shows an empty title when the row is still the default label', () => {
    expect(iwrTaskTitleInput('Công việc mới')).toBe('');
    expect(iwrTaskTitleInput('Gửi banner')).toBe('Gửi banner');
  });

  it('fills an empty task title from the KPI name and shows actual against target', () => {
    expect(iwrTitleForKpi('Công việc mới', 'Lead mới')).toBe('Lead mới');
    expect(iwrTitleForKpi('Gửi banner', 'Lead mới')).toBe('Gửi banner');
    expect(iwrKpiScore({ actual_value: 12, target_value: 20, metric_unit: 'lead' })).toBe('12/20 lead');
    expect(iwrKpiProgress({ id: 1, metric_name: 'Lead mới', target_value: 20, actual_value: 12 })).toBe(60);
    const seed = iwrKpiItemSeed({
      id: 4,
      metric_name: 'Lead mới',
      metric_unit: 'lead',
      target_value: 20,
      actual_value: 20,
    });
    expect(seed.section).toBe('done');
    expect(seed.title).toBe('Lead mới');
    expect(JSON.parse(seed.body)).toMatchObject({ kpi_id: 4, progress: 100, note: '20/20 lead' });
  });

  it('keeps a pasted link visible and adds https when the scheme is missing', () => {
    expect(iwrNormalizeEvidenceUrl('docs.google.com/a')).toBe('https://docs.google.com/a');
    expect(iwrNormalizeEvidenceUrl('https://ptt.vn/a')).toBe('https://ptt.vn/a');
    expect(iwrVisibleEvidenceUrl('bao-cao.pdf')).toBe('');
    expect(iwrVisibleEvidenceUrl('https://ptt.vn/a')).toBe('https://ptt.vn/a');
  });
});

describe('iwr-item-meta', () => {
  it('round-trips structured body and keeps legacy plain text', () => {
    const body = serializeIwrItemMeta({ project: 'Spa ABC', progress: 70, text: 'xong' });
    expect(parseIwrItemMeta(body)).toMatchObject({ project: 'Spa ABC', progress: 70, text: 'xong' });
    expect(parseIwrItemMeta('Chờ khách chốt')).toMatchObject({ text: 'Chờ khách chốt', note: 'Chờ khách chốt' });
  });

  it('computes KPI delta with higher/lower-is-better', () => {
    const leads = kpiDelta(1100, 1240, 'higher');
    expect(leads.diff).toBe(140);
    expect(leads.good).toBe(true);
    const cpl = kpiDelta(160000, 149000, 'lower');
    expect(cpl.diff).toBe(-11000);
    expect(cpl.good).toBe(true);
    const delivery = kpiDelta(100, 85, 'higher');
    expect(delivery.good).toBe(false);
  });

  it('formats date and detects overdue', () => {
    expect(formatViYmd('2026-09-03')).toBe('03/09/2026');
    expect(clampProgress(140)).toBe(100);
    expect(isOverdueYmd('2026-09-01', new Date('2026-09-03T10:00:00+07:00'))).toBe(true);
    expect(isOverdueYmd('2026-09-05', new Date('2026-09-03T10:00:00+07:00'))).toBe(false);
  });
});
