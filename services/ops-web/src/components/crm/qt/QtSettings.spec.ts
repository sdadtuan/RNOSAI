import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildQtSettingsPatch } from '@/lib/crm/qt-api';
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
