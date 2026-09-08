import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { dash } from '@/lib/crm/qt-format';
import { funnelFromProjectedKpis } from '@/lib/crm/qt-builder-w2.util';
import {
  QT_BUILDER_TABS,
  QT_SKU_TIERS,
  QtBuilderChrome,
  QtCatalogAddCta,
  QtContextFields,
  QtHistoryChrome,
  QtKpiChrome,
  QtMetaFunnel,
  QtOptionsChrome,
  QtSkuPicker,
  isQtWritable,
  lineWritePayload,
  newFeeCatalogLine,
  qtStatusLabel,
  saveDraft,
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

  it('renders live A/B/C option cards with recommended and client_visible', () => {
    const html = renderToStaticMarkup(
      createElement(QtOptionsChrome, {
        options: [
          {
            option_key: 'A',
            name: 'Growth Launch',
            recommended: true,
            client_visible: true,
            payable_vnd: 108_000_000,
          },
          {
            option_key: 'B',
            name: 'Essential',
            recommended: false,
            client_visible: true,
            payable_vnd: 86_000_000,
          },
          {
            option_key: 'C',
            name: 'Aggressive',
            recommended: false,
            client_visible: false,
            payable_vnd: 140_000_000,
          },
        ],
      }),
    );

    expect(html).toContain('A · Growth Launch');
    expect(html).toContain('B · Essential');
    expect(html).toContain('C · Aggressive');
    expect(html).toContain('Recommended');
    expect(html).toContain('client_visible');
    expect(html).toContain('108.000.000');
    expect(html).not.toContain('265647600');
    expect(html).not.toContain('265.647.600');
    expect(html).not.toContain('22,4');
    expect(html).not.toContain('8,46');
    expect(html).not.toContain('mở ở Wave');
    expect(html).toContain('qt-opt');
  });

  it('Meta funnel uses projected_result only and dashes missing CTR', () => {
    const funnel = funnelFromProjectedKpis([
      { name: 'Imp.', value_text: '2,4tr', class: 'projected_result' },
      { name: 'Click', value_text: '43K', class: 'projected_result' },
      { name: 'Lead', value_text: '1.5K', class: 'projected_result' },
      { name: 'CTR', value_text: '99%', class: 'committed' },
    ]);
    const html = renderToStaticMarkup(createElement(QtMetaFunnel, { funnel }));

    expect(html).toContain('2,4tr');
    expect(html).toContain('43K');
    expect(html).toContain('1.5K');
    expect(html).toContain(dash(null));
    expect(html).not.toContain('99%');
    expect(html).toContain('projected');
    expect(html).toContain('qt-funnel');
    expect(html).not.toContain('265647600');
    expect(html).not.toContain('22,4');
    expect(html).not.toContain('8,46');
  });

  it('KPI table lists official classes from live rows', () => {
    const html = renderToStaticMarkup(
      createElement(QtKpiChrome, {
        kpis: [
          {
            name: '24 bài / tháng',
            class: 'committed',
            value_text: '36 asset',
            source: 'deliverable',
            assumption: 'Duyệt ≤2 ngày',
          },
          {
            name: 'CTR Meta',
            class: 'optimization_target',
            value_text: '≥1,8%',
            source: 'Ads Manager',
            assumption: '',
          },
          {
            name: 'Lead',
            class: 'projected_result',
            value_text: '1.000',
            source: 'CRM',
            assumption: 'Media đủ',
          },
          {
            name: 'Ngân sách media',
            class: 'assumption_input',
            value_text: '120.000.000 ₫',
            source: 'khách',
            assumption: '',
          },
        ],
      }),
    );

    expect(html).toContain('committed');
    expect(html).toContain('optimization_target');
    expect(html).toContain('projected_result');
    expect(html).toContain('assumption_input');
    expect(html).toContain('24 bài / tháng');
    expect(html).toContain('1.000');
    expect(html).not.toContain('265647600');
    expect(html).not.toContain('22,4');
    expect(html).not.toContain('8,46');
  });

  it('history renders Task 23 diff rows without inventing numbers', () => {
    const html = renderToStaticMarkup(
      createElement(QtHistoryChrome, {
        versions: [
          { n: 1, state: 'superseded' },
          { n: 2, state: 'working' },
        ],
        diffs: [
          { path: 'lines[0].unit_price_vnd', from: '42000000', to: '48000000', critical: true },
          { path: 'payments[0].pct_bps', from: '6000', to: '5000', critical: true },
        ],
      }),
    );

    expect(html).toContain('v1');
    expect(html).toContain('v2');
    expect(html).toContain('superseded');
    expect(html).toContain('working');
    expect(html).toContain('lines[0].unit_price_vnd');
    expect(html).toContain('42000000');
    expect(html).toContain('48000000');
    expect(html).toContain('qt-diff');
    expect(html).not.toContain('265647600');
    expect(html).not.toContain('22,4');
    expect(html).not.toContain('8,46');
    expect(html).not.toContain('mở ở Wave');
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

  it('omits media_vnd when adding a new fee catalog line', () => {
    const line = newFeeCatalogLine({
      dv_code: 'DV02',
      name: 'Meta Ads',
      status: 'active',
      can_add_to_client_quote: true,
      package_tiers: [{ tier: 'standard', suggested_vnd: 10_000_000 }],
    });
    expect(line.item_type).toBe('fee');
    expect(line).not.toHaveProperty('media_vnd');
    expect(lineWritePayload(line, false)).not.toHaveProperty('media_vnd');
  });
});

describe('BLD-01 lock when not writable', () => {
  it('disables context fields for pending_approval and saveDraft is a no-op', async () => {
    const writable = isQtWritable('pending_approval');
    const html = renderToStaticMarkup(
      createElement(QtContextFields, {
        title: 'Growth Q4',
        objective: 'Awareness',
        audience: 'C-level',
        period: 'Q4 2026',
        validUntil: '2026-12-31',
        writable,
        onTitleChange: () => {},
        onObjectiveChange: () => {},
        onAudienceChange: () => {},
        onPeriodChange: () => {},
        onValidUntilChange: () => {},
      }),
    );

    expect(html).toMatch(/Tiêu đề[\s\S]*?<input[^>]*disabled/);
    expect(html).toMatch(/Mục tiêu[\s\S]*?<input[^>]*disabled/);
    expect(html).toMatch(/Đối tượng[\s\S]*?<input[^>]*disabled/);
    expect(html).toMatch(/Thời gian[\s\S]*?<input[^>]*disabled/);
    expect(html).toMatch(/Hiệu lực đến[\s\S]*?<input[^>]*disabled/);

    const write = vi.fn();
    await saveDraft({ id: 9, status: 'pending_approval' }, write);
    expect(write).not.toHaveBeenCalled();
  });
});
