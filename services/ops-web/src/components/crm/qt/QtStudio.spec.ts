import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { dash } from '@/lib/crm/qt-format';
import {
  QT_STUDIO_PUBLISH_REASON,
  QT_STUDIO_SECTIONS,
  QtStudioChrome,
  canPublishStudio,
  hydrateStudioSections,
  pickPublicPreview,
  studioSectionsForPublish,
  type QtStudioPreview,
} from './QtStudio';

const FORBIDDEN = ['sẽ có ở W2', 'mở ở Wave', 'NOVA', 'Nhảy màn', '265.647.600', '265647600'];
const LEAK = ['margin', 'NSR', 'nsr', 'gm_bps', 'cost'];

const PREVIEW: QtStudioPreview = {
  quote_code: 'QT-PTT-2026-000089',
  title: 'Growth Proposal Q4/2026',
  objective: 'Lead căn hộ cao cấp',
  audience: 'CFO',
  campaign_period: '2026-Q4',
  valid_until: '2026-10-07',
  version_n: 2,
  kpis: [{ label: 'Lead dự kiến', value: '1.000' }],
  scope: [{ dv_code: 'DV08', notes: 'Meta Ads' }],
  investment: {
    fee_vnd: 100_000_000,
    media_vnd: 20_000_000,
    discount_vnd: 0,
    tax_vnd: 8_000_000,
    payable_vnd: 128_000_000,
  },
  payments: [{ seq: 1, pct_bps: 5000, amount_vnd: 64_000_000, milestone: 'Kickoff' }],
  options: [
    { option_key: 'A', name: 'Standard', client_visible: true, payable_vnd: 128_000_000 },
    { option_key: 'B', name: 'Growth', client_visible: true, payable_vnd: 150_000_000 },
    { option_key: 'C', name: 'Hidden internal', client_visible: false, payable_vnd: 1 },
  ],
  cta: { accept: 'Xác nhận đề xuất' },
};

function assertClean(html: string) {
  expect(html).not.toContain('<main');
  for (const banned of FORBIDDEN) {
    expect(html).not.toContain(banned);
  }
}

function previewHtml(html: string): string {
  const match = html.match(/data-preview="client"[\s\S]*$/);
  return match?.[0] ?? html;
}

describe('QtStudioChrome', () => {
  it('shows 9 PRS-01 sections and a disabled publish with version_not_approved', () => {
    expect(QT_STUDIO_SECTIONS.map((section) => section.label)).toEqual([
      '01 Cover & thương hiệu',
      '02 Bối cảnh & mục tiêu',
      '03 Chiến lược',
      '04 Phạm vi',
      '05 KPI & hiệu quả',
      '06 Timeline',
      '07 Đầu tư',
      '08 Điều khoản',
      '09 Xác nhận',
    ]);
    expect(QT_STUDIO_PUBLISH_REASON).toBe('version_not_approved');

    const html = renderToStaticMarkup(createElement(QtStudioChrome, {}));

    for (const section of QT_STUDIO_SECTIONS) {
      expect(html).toContain(section.label.replace(/&/g, '&amp;'));
    }
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Xuất bản/);
    expect(html).toContain('version_not_approved');
    expect(html).toContain(dash(null));
    assertClean(html);
  });

  it('toggles 08/09 and previews the same public GET fields without leak or mock money', () => {
    expect(canPublishStudio({ versionState: 'approved', section08: true, section09: true })).toBe(
      true,
    );
    expect(canPublishStudio({ versionState: 'draft', section08: true, section09: true })).toBe(
      false,
    );
    expect(canPublishStudio({ versionState: 'approved', section08: false, section09: true })).toBe(
      false,
    );

    const leaked = pickPublicPreview({
      ...PREVIEW,
      cost: 40_000_000,
      margin: 0.224,
      nsr: 100_000_000,
      nsr_vnd: 100_000_000,
      gm_bps: 2240,
    });
    expect(leaked).not.toHaveProperty('cost');
    expect(leaked).not.toHaveProperty('margin');
    expect(leaked).not.toHaveProperty('nsr');
    expect(leaked.options?.map((row) => row.option_key)).toEqual(['A', 'B']);

    const html = renderToStaticMarkup(
      createElement(QtStudioChrome, {
        preview: PREVIEW,
        versionState: 'approved',
        section08: true,
        section09: true,
        quoteCode: PREVIEW.quote_code,
      }),
    );

    expect(html).toContain('Growth Proposal Q4/2026');
    expect(html).toContain('Lead căn hộ cao cấp');
    expect(html).toContain('Meta Ads');
    expect(html).toContain('Xác nhận đề xuất');
    expect(html).toContain('data-section-toggle="08"');
    expect(html).toContain('data-section-toggle="09"');
    expect(html).not.toContain('Hidden internal');
    expect(html).not.toMatch(/ký hợp đồng/i);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Xuất bản/);
    assertClean(html);
    const client = previewHtml(html);
    for (const leak of LEAK) {
      expect(client).not.toContain(leak);
    }
  });

  it('empty preview money is an em dash and publish stays gated when 09 is off', () => {
    const html = renderToStaticMarkup(
      createElement(QtStudioChrome, {
        preview: {
          ...PREVIEW,
          title: '',
          objective: '',
          investment: {
            fee_vnd: null,
            media_vnd: null,
            discount_vnd: null,
            tax_vnd: null,
            payable_vnd: null,
          },
        },
        versionState: 'approved',
        section08: true,
        section09: false,
      }),
    );
    expect(html).toContain(dash(null));
    expect(html).toContain('studio_gate');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Xuất bản/);
    expect(html).not.toContain('265647600');
  });

  it('defaults 08/09 OFF and publish does not persist unsaved defaults', () => {
    expect(hydrateStudioSections(null)).toEqual({ section08: false, section09: false });
    expect(hydrateStudioSections({})).toEqual({ section08: false, section09: false });
    expect(studioSectionsForPublish({ dirty: false, section08: false, section09: false })).toBeNull();
    expect(studioSectionsForPublish({ dirty: false, section08: true, section09: true })).toBeNull();

    const html = renderToStaticMarkup(
      createElement(QtStudioChrome, { versionState: 'approved' }),
    );
    expect(html).toContain('studio_gate');
    expect(html).toMatch(/data-section-toggle="08"/);
    expect(html).toMatch(/data-section-toggle="09"/);
    expect(html).not.toMatch(/checked[^>]*data-section-toggle="08"/);
    expect(html).not.toMatch(/checked[^>]*data-section-toggle="09"/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Xuất bản/);
  });

  it('hydrates OFF from snapshot and saved OFF stays OFF', () => {
    expect(
      hydrateStudioSections({
        studio: { sections: { '08': { on: false }, '09': { on: false } } },
      }),
    ).toEqual({ section08: false, section09: false });
    expect(
      studioSectionsForPublish({ dirty: true, section08: false, section09: false }),
    ).toEqual({ '08': false, '09': false });
    const html = renderToStaticMarkup(
      createElement(QtStudioChrome, {
        versionState: 'approved',
        section08: false,
        section09: false,
      }),
    );
    expect(html).toContain('studio_gate');
    expect(html).not.toMatch(/checked[^>]*data-section-toggle="08"/);
    expect(html).not.toMatch(/checked[^>]*data-section-toggle="09"/);
  });

  it('Xuất bản invokes onPublish for an approved version with 08/09 on', () => {
    const onPublish = vi.fn();
    const html = renderToStaticMarkup(
      createElement(QtStudioChrome, {
        preview: PREVIEW,
        versionState: 'approved',
        section08: true,
        section09: true,
        onPublish,
      }),
    );
    expect(html).toContain('Xuất bản');
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Xuất bản/);
  });
});
