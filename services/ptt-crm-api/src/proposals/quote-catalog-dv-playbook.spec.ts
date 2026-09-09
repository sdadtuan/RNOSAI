import {
  QT_CATALOG_NAV_GROUPS,
  QT_DV_NAV_GROUP,
  QT_DV_PLAYBOOKS,
  formatPlaybookKpis,
  getDvPlaybook,
  resolveQuoteCatalogGroup,
  skuCodesFor,
} from './quote-catalog-dv-playbook';

describe('quote-catalog-dv-playbook', () => {
  it('covers DV01–DV21 exactly once and never invents a 22nd family', () => {
    const codes = Array.from({ length: 21 }, (_, i) => `DV${String(i + 1).padStart(2, '0')}`);
    expect(Object.keys(QT_DV_PLAYBOOKS).sort()).toEqual([...codes].sort());
    expect(Object.keys(QT_DV_NAV_GROUP).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      expect(QT_DV_PLAYBOOKS[code].group).toBe(QT_DV_NAV_GROUP[code]);
      expect(QT_CATALOG_NAV_GROUPS).toContain(QT_DV_PLAYBOOKS[code].group);
    }
  });

  it('maps official DV codes even when the display name is misleading', () => {
    expect(resolveQuoteCatalogGroup('DV08', 'Meta Ads Performance', 'meta-ads')).toBe('crm');
    expect(resolveQuoteCatalogGroup('DV04', 'Meta Ads Performance', 'meta-ads')).toBe('performance');
    expect(resolveQuoteCatalogGroup('DV05', 'Content & Social retainer', 'content')).toBe('seo');
    expect(resolveQuoteCatalogGroup('DV02', 'Content & Social retainer', 'content')).toBe('content');
    expect(resolveQuoteCatalogGroup('DV12', 'Báo cáo phân tích thị trường', 'phan-tich-thi-truong')).toBe(
      'strategy',
    );
    expect(resolveQuoteCatalogGroup('DV19', 'TikTok Shop Operations', 'tiktok-shop')).toBe('performance');
  });

  it('keeps VID-TPL / brand-film names on production regardless of dv_code', () => {
    expect(resolveQuoteCatalogGroup('DV12', 'Brand Film / Reels', 'brand-film')).toBe('production');
    expect(resolveQuoteCatalogGroup('DV05', 'Video storyboard', 'video-storyboard')).toBe('production');
  });

  it('keeps package keyword grouping and unknown codes on keyword fallback', () => {
    expect(resolveQuoteCatalogGroup('PKG01', 'Package ngành BĐS', 'package-bds')).toBe('package');
    expect(resolveQuoteCatalogGroup('', 'Sales Enablement B2B', 'sales-deck')).toBe('sales');
  });

  it('treats DV19 as a real TMĐT family, not Custom/Draft playbook', () => {
    const shop = getDvPlaybook('DV19');
    expect(shop?.group).toBe('performance');
    expect(shop?.channel_lines.join(' ')).toMatch(/TikTok Shop/);
    expect(shop?.assume.some((row) => /Rate Card/i.test(row))).toBe(true);
    expect(shop?.kpis.some((row) => row.kind === 'forecast' && /GMV/i.test(row.name))).toBe(true);
  });

  it('exposes CB/TC/CS SKU codes on the same dv_code', () => {
    expect(skuCodesFor('dv04')).toEqual(['DV04-CB', 'DV04-TC', 'DV04-CS']);
    expect(formatPlaybookKpis(QT_DV_PLAYBOOKS.DV04, 'forecast')).toMatch(/Leads/);
    expect(formatPlaybookKpis(QT_DV_PLAYBOOKS.DV04, 'committed')).toMatch(/Campaign/);
  });
});
