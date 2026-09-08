import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { qtCatalogImportOutcome } from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';
import {
  QT_CATALOG_DRAWER_TABS,
  QT_CATALOG_NAV_GROUPS,
  QtCatalogDrawer,
  QtCatalogGroups,
  QtCatalogRates,
  QtCatalogServiceRow,
  QtVidTpl01Template,
} from './QtCatalog';

describe('QtCatalog CAT-01 groups', () => {
  it('renders exactly 13 CAT-01 group cards', () => {
    expect([...QT_CATALOG_NAV_GROUPS]).toEqual([
      'strategy',
      'branding',
      'content',
      'production',
      'performance',
      'web',
      'seo',
      'crm',
      'retention',
      'pr',
      'event',
      'sales',
      'data',
    ]);

    const html = renderToStaticMarkup(createElement(QtCatalogGroups, { items: [] }));
    const groups = [...html.matchAll(/data-group="([^"]+)"/g)].map((match) => match[1]);

    expect(groups).toEqual([...QT_CATALOG_NAV_GROUPS]);
    expect(groups).toHaveLength(13);
    expect(html).not.toContain('<main');
    expect(html).not.toContain('265.647.600');
    expect(html).not.toContain('NOVA');
    expect(html).not.toContain('Nhảy màn');
    expect(html).not.toContain('mở ở Wave');
  });

  it('adds a package card when the API returns package items', () => {
    const html = renderToStaticMarkup(
      createElement(QtCatalogGroups, {
        items: [
          {
            dv_code: 'PKG-BDS',
            name_vi: 'Growth Launch',
            group: 'package',
            status: 'active',
            can_add_to_client_quote: true,
          },
        ],
      }),
    );
    const groups = [...html.matchAll(/data-group="([^"]+)"/g)].map((match) => match[1]);
    expect(groups).toHaveLength(14);
    expect(groups[13]).toBe('package');
  });
});

describe('QtCatalog draft add', () => {
  it('shows Draft and disables add-to-quote when can_add_to_client_quote is false', () => {
    const html = renderToStaticMarkup(
      createElement(QtCatalogServiceRow, {
        item: {
          dv_code: 'DV99',
          name_vi: 'CRM Automation',
          group: 'crm',
          status: 'draft',
          can_add_to_client_quote: false,
        },
      }),
    );

    expect(html).toContain('Draft');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Thêm vào báo giá/);
    expect(html).not.toContain('265.647.600');
    expect(dash(null)).toBe('—');
  });

  it('disables add-to-quote when status is draft even if can_add_to_client_quote is true', () => {
    const html = renderToStaticMarkup(
      createElement(QtCatalogServiceRow, {
        item: {
          dv_code: 'DV12',
          name_vi: 'Brand Film draft',
          group: 'production',
          status: 'draft',
          can_add_to_client_quote: true,
        },
      }),
    );

    expect(html).toContain('Draft');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Thêm vào báo giá/);
  });
});

describe('QtCatalog CAT-05 VID-TPL-01', () => {
  it('shows the static 6-scene template and a disabled convert button', () => {
    const html = renderToStaticMarkup(createElement(QtVidTpl01Template));

    expect(html).toContain('VID-TPL-01');
    expect(html).toContain('Hook căn hộ / lifestyle');
    expect(html).toContain('Vấn đề khách');
    expect(html).toContain('Giải pháp PTT');
    expect(html).toContain('Social proof');
    expect(html).toContain('Offer');
    expect(html).toContain('CTA đặt lịch');
    expect(html).toContain('0–6s');
    expect(html).toContain('40–45s');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Dùng khi convert DV12/);
    expect(html).not.toContain('<main');
    expect(html).not.toContain('265.647.600');
    expect(html).not.toContain('video/mp4');
  });
});

describe('QtCatalog CAT-02 drawer tabs', () => {
  it('exposes the 6 tab ids overview, deliverable, KPI, timeline, pricing, policy', () => {
    expect(QT_CATALOG_DRAWER_TABS.map((tab) => tab.id)).toEqual([
      'overview',
      'deliverable',
      'kpi',
      'timeline',
      'pricing',
      'policy',
    ]);

    const html = renderToStaticMarkup(
      createElement(QtCatalogDrawer, {
        item: {
          dv_code: 'DV08',
          name_vi: 'Meta Ads Performance',
          group: 'performance',
          status: 'active',
          can_add_to_client_quote: true,
        },
        hasFinance: true,
      }),
    );

    for (const id of ['overview', 'deliverable', 'kpi', 'timeline', 'pricing', 'policy']) {
      expect(html).toContain(`data-tab="${id}"`);
    }
    expect(html).toContain('KPI');
    expect(html).not.toContain('265.647.600');
    expect(html).not.toContain('NOVA');
  });

  it('renders CTA and UTA in overview or —', () => {
    const withCopy = renderToStaticMarkup(
      createElement(QtCatalogDrawer, {
        item: {
          dv_code: 'DV08',
          name_vi: 'Meta Ads Performance',
          group: 'performance',
          status: 'active',
          can_add_to_client_quote: true,
          drawer: {
            overview: {
              included: ['Setup pixel'],
              excluded: ['Media buy'],
              cta: 'Đặt lịch tư vấn',
              uta: 'Không cam kết CPL',
              owner: 'Performance Lead',
              effort: '12 MD',
            },
          },
        },
        hasFinance: false,
      }),
    );
    expect(withCopy).toContain('CTA');
    expect(withCopy).toContain('Đặt lịch tư vấn');
    expect(withCopy).toContain('UTA');
    expect(withCopy).toContain('Không cam kết CPL');

    const empty = renderToStaticMarkup(
      createElement(QtCatalogDrawer, {
        item: {
          dv_code: 'DV08',
          name_vi: 'Meta Ads Performance',
          group: 'performance',
          status: 'active',
          can_add_to_client_quote: true,
        },
        hasFinance: false,
      }),
    );
    expect(empty).toContain('CTA');
    expect(empty).toContain('UTA');
    expect(empty).toMatch(/CTA[\s\S]*—/);
    expect(empty).toMatch(/UTA[\s\S]*—/);
    expect(empty).not.toContain('265.647.600');
  });

  it('pricing tab renders cost or — when hasFinance', () => {
    const withCost = renderToStaticMarkup(
      createElement(QtCatalogDrawer, {
        item: {
          dv_code: 'DV08',
          name_vi: 'Meta Ads',
          status: 'active',
          can_add_to_client_quote: true,
          drawer: { pricing: { cost_labor_vnd: 9200000, package_tiers: [] } },
        },
        tab: 'pricing',
        hasFinance: true,
      }),
    );
    expect(withCost).toContain('Cost');
    expect(withCost).toContain('9200000');

    const missing = renderToStaticMarkup(
      createElement(QtCatalogDrawer, {
        item: {
          dv_code: 'DV08',
          name_vi: 'Meta Ads',
          status: 'active',
          can_add_to_client_quote: true,
          drawer: { pricing: { cost_labor_vnd: null, package_tiers: [] } },
        },
        tab: 'pricing',
        hasFinance: true,
      }),
    );
    expect(missing).toContain('Cost');
    expect(missing).toContain(dash(null));
  });
});

describe('QtCatalog CAT-04 rate pills', () => {
  it('shows Retired for retired state and rate_expired only when date-expired', () => {
    const html = renderToStaticMarkup(
      createElement(QtCatalogRates, {
        cards: [
          {
            id: 'rc-retired',
            dv_code: 'DV08',
            package_tier: 'standard',
            fee_vnd: 12_000_000,
            effective_from: '2026-01-01',
            effective_to: '2026-12-31',
            state: 'retired',
            rate_expired: false,
          },
          {
            id: 'rc-expired',
            dv_code: 'DV05',
            package_tier: 'standard',
            fee_vnd: 18_000_000,
            effective_from: '2025-01-01',
            effective_to: '2025-12-31',
            state: 'active',
            rate_expired: true,
          },
        ],
      }),
    );

    expect(html).toContain('Retired');
    expect(html).toContain('Active');
    expect(html).toContain('data-rate-expired="0"');
    expect(html).toContain('data-rate-expired="1"');
    expect(html).toContain('rate_expired');
    const retiredRow = html.split('rc-retired')[0] ?? html;
    expect(html).toMatch(/data-rate-expired="0"[\s\S]*Retired/);
    expect(retiredRow).not.toMatch(/rc-retired[\s\S]*rate_expired/);
    expect(html).not.toContain('265.647.600');
  });

  it('state: failed import surfaces as error and not success', () => {
    const outcome = qtCatalogImportOutcome({
      job_id: 'job-1',
      state: 'failed',
      result: { rate_cards: 0, revisions: 0, errors: ['mid_batch_rate_fail'] },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('expected failed');

    const html = renderToStaticMarkup(
      createElement(QtCatalogRates, { cards: [], importError: outcome.error }),
    );
    expect(html).toContain('mid_batch_rate_fail');
    expect(html).toContain('qt-card--error');
    expect(html).not.toContain('Đã nhập');
  });
});
