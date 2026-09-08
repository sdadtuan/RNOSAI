import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dash } from '@/lib/crm/qt-format';
import {
  QT_BUILDER_TABS,
  QT_SKU_TIERS,
  QtBuilderChrome,
  QtCatalogAddCta,
  QtHistoryChrome,
  QtKpiChrome,
  QtOptionsChrome,
  QtSkuPicker,
  isQtWritable,
  lineWritePayload,
  qtStatusLabel,
} from './QtBuilder';

describe('QtBuilder tabs + chrome', () => {
  it('renders all seven tabs with Vietnamese labels', () => {
    expect(QT_BUILDER_TABS.map((tab) => tab.label)).toEqual([
      'Bối cảnh',
      'Phương án',
      'Dịch vụ',
      'KPI',
      'Chi phí',
      'Điều khoản',
      'Lịch sử',
    ]);

    const html = renderToStaticMarkup(
      createElement(QtBuilderChrome, {
        title: 'Growth Q4',
        quoteCode: 'QT-PTT-2026-000001',
        status: 'draft',
        tab: 'context',
        onTab: () => {},
      }),
    );

    expect(html).toContain('Bối cảnh');
    expect(html).toContain('Phương án');
    expect(html).toContain('Dịch vụ');
    expect(html).toContain('KPI');
    expect(html).toContain('Chi phí');
    expect(html).toContain('Điều khoản');
    expect(html).toContain('Lịch sử');
    expect(html).toContain('Nháp');
    expect(html).not.toContain('mở ở Wave');
    expect(html).not.toContain('NOVA');
    expect(html).not.toContain('<main');
    expect(html).toContain('qt-tabs');
  });

  it('SKU persist keys are basic|standard|premium with VI labels', () => {
    expect(QT_SKU_TIERS.map((tier) => tier.id)).toEqual(['basic', 'standard', 'premium']);
    expect(QT_SKU_TIERS.map((tier) => tier.label)).toEqual(['Cơ bản', 'Tiêu chuẩn', 'Chuyên sâu']);

    const html = renderToStaticMarkup(
      createElement(QtSkuPicker, { value: 'standard', onChange: () => {} }),
    );
    expect(html).toContain('Cơ bản');
    expect(html).toContain('Tiêu chuẩn');
    expect(html).toContain('Chuyên sâu');
    expect(html).toContain('qt-sku');
  });

  it('disables Draft catalog add CTA', () => {
    const html = renderToStaticMarkup(
      createElement(QtCatalogAddCta, {
        name: 'Brand Film custom',
        canAdd: false,
        reason: 'catalog_not_active',
      }),
    );

    expect(html).toMatch(/disabled/);
    expect(html).toContain('catalog_not_active');
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>[\s\S]*mở ở Wave/);
  });

  it('enables add CTA when catalog is active', () => {
    const html = renderToStaticMarkup(
      createElement(QtCatalogAddCta, {
        name: 'Meta Ads',
        canAdd: true,
      }),
    );
    expect(html).not.toMatch(/<button[^>]*disabled/);
  });

  it('W2 chrome still renders empty dash — one implicit A, empty KPI, history v1', () => {
    const options = renderToStaticMarkup(createElement(QtOptionsChrome));
    expect(options).toContain('A');
    expect(options).toContain(dash(null));
    expect(options).not.toContain('mở ở Wave');
    expect(options).not.toContain('B ·');
    expect(options).not.toContain('C ·');

    const kpi = renderToStaticMarkup(createElement(QtKpiChrome));
    expect(kpi).toContain('Chỉ số');
    expect(kpi).toContain(dash(null));
    expect(kpi).not.toContain('mở ở Wave');

    const history = renderToStaticMarkup(createElement(QtHistoryChrome, { versionN: 1 }));
    expect(history).toContain('v1');
    expect(history).not.toContain('v2');
    expect(history).not.toContain('mở ở Wave');
  });

  it('status pills are Vietnamese', () => {
    expect(qtStatusLabel('draft')).toBe('Nháp');
    expect(qtStatusLabel('pending_approval')).toBe('Chờ phê duyệt');
    expect(qtStatusLabel('accepted')).toBe('Đã xác nhận');
    expect(qtStatusLabel('sent')).toBe('Đã gửi');
  });

  it('does not enable writes for pending_approval painted as Nháp', () => {
    expect(isQtWritable('draft')).toBe(true);
    expect(isQtWritable('draft', 'working')).toBe(true);
    expect(isQtWritable('pending_approval')).toBe(false);
    expect(isQtWritable('pending_approval', 'working')).toBe(false);
    expect(isQtWritable('draft', 'published')).toBe(false);
    expect(qtStatusLabel('pending_approval')).not.toBe('Nháp');
  });
});

describe('lineWritePayload', () => {
  it('omits cost keys when finance is off and cost is missing', () => {
    const payload = lineWritePayload(
      { dv_code: 'DV02', package_tier: 'standard' },
      false,
    );
    expect(payload).not.toHaveProperty('cost_labor_vnd');
    expect(payload).not.toHaveProperty('cost_outsource_vnd');
    expect(payload).not.toHaveProperty('cost_other_vnd');
    expect(JSON.stringify(payload)).not.toMatch(/"cost_/);
  });

  it('omits media_vnd and item_type when unknown', () => {
    const payload = lineWritePayload(
      { dv_code: 'DV02', package_tier: 'standard' },
      false,
    );
    expect(payload).not.toHaveProperty('item_type');
    expect(payload).not.toHaveProperty('media_vnd');
    expect(payload).not.toHaveProperty('media_amount_vnd');
  });

  it('includes finance cost when a real cost is present', () => {
    const payload = lineWritePayload(
      {
        dv_code: 'DV02',
        package_tier: 'standard',
        item_type: 'fee',
        media_vnd: 12_000_000,
        cost_labor_vnd: 10_000_000,
        cost_outsource_vnd: 2_000_000,
      },
      true,
    );
    expect(payload.item_type).toBe('fee');
    expect(payload.media_vnd).toBe(12_000_000);
    expect(payload.cost_labor_vnd).toBe(10_000_000);
    expect(payload.cost_outsource_vnd).toBe(2_000_000);
    expect(payload).not.toHaveProperty('cost_other_vnd');
  });

  it('never sends missing cost_* as 0 even with finance', () => {
    const payload = lineWritePayload(
      { dv_code: 'DV02', package_tier: 'standard', item_type: 'media' },
      true,
    );
    expect(payload).not.toHaveProperty('cost_labor_vnd');
    expect(payload).not.toHaveProperty('cost_outsource_vnd');
    expect(payload).not.toHaveProperty('cost_other_vnd');
    expect(JSON.stringify(payload)).not.toMatch(/"cost_\w+_vnd":0/);
  });
});
