import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildQtSettingsPatch, qtCatalogImportOutcome } from '@/lib/crm/qt-api';
import { QT_SETTINGS_TABS, QtSettingsForm } from './QtSettings';

const SAMPLE = {
  quote_code_pattern: 'QT-PTT-{YYYY}-{SEQ:6}',
  validity_days: 30,
  vat_bps: 800,
  currency_code: 'VND',
  timezone: 'Asia/Ho_Chi_Minh',
  issuing_entity: 'PTT-HCM',
  payment_template: '50/30/20',
  gm_floor_bps: 2500,
  discount_auto_bps: 500,
  director_value_vnd: 200000000,
  payment_term_max_days: 60,
  share_expiry_days: 14,
  pdf_download: true,
  otp_required: true,
  view_tracking: true,
  ai_enabled: false,
  handoff_video: false,
};

const FORBIDDEN = ['sẽ có ở W2', 'mở ở Wave', 'NOVA', 'Nhảy màn'];

describe('QtSettingsForm', () => {
  it('keeps quote_code_pattern readonly and exposes SET-01…06 tabs', () => {
    expect(QT_SETTINGS_TABS.map((tab) => tab.id)).toEqual([
      'set-01',
      'set-02',
      'set-03',
      'set-04',
      'set-05',
      'set-06',
    ]);

    const html = renderToStaticMarkup(
      createElement(QtSettingsForm, { settings: SAMPLE, tab: 'set-01' }),
    );

    expect(html).toMatch(/name="quote_code_pattern"[^>]*readonly/i);
    expect(html).toContain('QT-PTT-{YYYY}-{SEQ:6}');
    expect(html).toContain('ai_enabled');
    expect(html).not.toContain('<main');
    for (const banned of FORBIDDEN) {
      expect(html).not.toContain(banned);
    }
  });

  it('SET-03 exposes catalog CSV/JSON import', () => {
    const html = renderToStaticMarkup(
      createElement(QtSettingsForm, { settings: SAMPLE, tab: 'set-03' }),
    );
    expect(html).toMatch(/import|Nhập catalog/i);
    expect(html).toMatch(/csv|json/i);
    expect(html).toContain('qt-btn');
  });

  it('state: failed import surfaces as error and not success', () => {
    const outcome = qtCatalogImportOutcome({
      job_id: 'job-1',
      state: 'failed',
      result: { rate_cards: 0, revisions: 0, errors: ['mid_batch_rate_fail'] },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('expected failed');
    expect(outcome.error).toContain('mid_batch_rate_fail');
    expect(outcome.error).not.toMatch(/Đã nhập/);

    const html = renderToStaticMarkup(
      createElement(QtSettingsForm, {
        settings: SAMPLE,
        tab: 'set-03',
        importError: outcome.error,
      }),
    );
    expect(html).toContain('mid_batch_rate_fail');
    expect(html).toContain('qt-card--error');
    expect(html).not.toContain('Đã nhập');
  });
});

describe('buildQtSettingsPatch', () => {
  it('sends the PATCH allowlist only and drops quote_code_pattern', () => {
    expect(
      buildQtSettingsPatch({
        quote_code_pattern: 'QT-HACK-{YYYY}-{SEQ:6}',
        currency_code: 'USD',
        vat_bps: 800,
        ai_enabled: true,
      }),
    ).toEqual({ vat_bps: 800, ai_enabled: true });
  });
});
