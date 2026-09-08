import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dash } from '@/lib/crm/qt-format';
import { QtStickyCommercial, type QtStickyMoney } from './QtStickyCommercial';

const MONEY: QtStickyMoney = {
  fee_vnd: 100000000,
  media_vnd: 40000000,
  discount_vnd: 5000000,
  tax_vnd: 8000000,
  payable_vnd: 143000000,
  nsr_vnd: 95000000,
  gm_bps: 2800,
};

const PAYMENTS = [
  { pct_bps: 5000, amount_vnd: 71500000, milestone: 'Xác nhận đề xuất' },
  { pct_bps: 3000, amount_vnd: 42900000, milestone: 'Giữa kỳ' },
  { pct_bps: 2000, amount_vnd: 28600000, milestone: 'Nghiệm thu' },
];

describe('QtStickyCommercial', () => {
  it('hides NSR and GM without finance and never mounts those numbers', () => {
    const html = renderToStaticMarkup(
      createElement(QtStickyCommercial, {
        money: MONEY,
        payments: PAYMENTS,
        hasFinance: false,
      }),
    );

    expect(html).toContain('Phí dịch vụ');
    expect(html).toContain('Media');
    expect(html).toContain('Chiết khấu');
    expect(html).toContain('VAT');
    expect(html).toContain('Tổng phải thu');
    expect(html).toContain('Thanh toán');
    expect(html).toContain('50%');
    expect(html).toContain('30%');
    expect(html).toContain('20%');
    expect(html).not.toContain('NSR');
    expect(html).not.toContain('Gross margin');
    expect(html).not.toContain('Sức khỏe nội bộ');
    expect(html).not.toContain('95.000.000');
    expect(html).not.toContain('22,4');
    expect(html).not.toContain('8,46');
    expect(html).not.toContain('NOVA');
    expect(html).not.toContain('<main');
    expect(html).toContain('qt-sticky');
  });

  it('shows NSR and GM when crm_quote.finance is present', () => {
    const html = renderToStaticMarkup(
      createElement(QtStickyCommercial, {
        money: MONEY,
        payments: PAYMENTS,
        hasFinance: true,
      }),
    );

    expect(html).toContain('NSR');
    expect(html).toContain('Gross margin');
    expect(html).toContain('Sức khỏe nội bộ');
  });

  it('dashes null commercial amounts', () => {
    const html = renderToStaticMarkup(
      createElement(QtStickyCommercial, {
        money: {
          fee_vnd: null,
          media_vnd: null,
          discount_vnd: null,
          tax_vnd: null,
          payable_vnd: null,
          nsr_vnd: null,
          gm_bps: null,
        },
        payments: [],
        hasFinance: true,
      }),
    );

    expect(html).toContain(dash(null));
    expect(html.match(/—/g)?.length).toBeGreaterThanOrEqual(5);
    expect(html).not.toContain('265.647.600');
  });
});
