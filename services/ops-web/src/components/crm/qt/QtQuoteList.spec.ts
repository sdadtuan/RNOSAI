import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dash } from '@/lib/crm/qt-format';
import {
  QT_LIST_CHIPS,
  QtListChips,
  QtQuoteTable,
  activeListChip,
  listQueryFromSearch,
  type QtListItem,
} from './QtQuoteList';

const EMPTY_ROW: QtListItem = {
  id: 1,
  quote_code: null,
  version_n: null,
  client_name: null,
  lead_code: null,
  option: null,
  payable_vnd: null,
  fee_vnd: null,
  gm_bps: null,
  status: 'draft',
  valid_until: null,
  owner: { staff_id: null, name: null },
};

describe('dash contract', () => {
  it('renders null as an em dash', () => {
    expect(dash(null)).toBe('—');
  });
});

describe('QtQuoteTable', () => {
  it('dashes null columns and never hard-codes mockup money', () => {
    const html = renderToStaticMarkup(createElement(QtQuoteTable, { items: [EMPTY_ROW] }));

    expect(html).toContain('—');
    expect(html.match(/—/g)?.length).toBeGreaterThanOrEqual(6);
    expect(html).not.toContain('265.647.600');
    expect(html).not.toContain('8,46');
    expect(html).not.toContain('<main');
    expect(html).toContain('qt-table');
  });

  it('shows version n, option dash, and finance GM dash', () => {
    const html = renderToStaticMarkup(
      createElement(QtQuoteTable, {
        items: [
          {
            ...EMPTY_ROW,
            quote_code: 'QT-PTT-2026-000001',
            version_n: 1,
            client_name: 'Bloom',
            lead_code: 'LD-12',
            option: null,
            payable_vnd: 0,
            fee_vnd: 0,
            gm_bps: null,
            owner: { staff_id: 7, name: 'AM Kiều' },
          },
        ],
      }),
    );

    expect(html).toContain('QT-PTT-2026-000001');
    expect(html).toContain('v1');
    expect(html).toContain('Bloom');
    expect(html).toContain('LD-12');
    expect(html).toContain('AM Kiều');
    expect(html).toMatch(/Phương án[\s\S]*—|—/);
    expect(html).not.toContain('265.647.600');
  });
});

describe('list chips + open=1', () => {
  it('exposes All / Mine / Pending me / Expiring / Sent no reply in Vietnamese', () => {
    expect(QT_LIST_CHIPS.map((chip) => chip.id)).toEqual([
      'all',
      'mine',
      'pending',
      'expiring',
      'sent',
    ]);
    const html = renderToStaticMarkup(createElement(QtListChips, { active: 'all', onChange: () => {} }));
    expect(html).toContain('Tất cả');
    expect(html).toContain('Của tôi');
    expect(html).toContain('Chờ tôi phê duyệt');
    expect(html).toContain('Sắp hết hạn');
    expect(html).toContain('Đã gửi chưa phản hồi');
    expect(html).toContain('qt-chip');
  });

  it('tile-1 open=1 activates mine-open, or all-open when scope=all', () => {
    expect(activeListChip(new URLSearchParams('open=1'))).toBe('mine');
    expect(activeListChip(new URLSearchParams('open=1&scope=all'))).toBe('all');
    const mineOpen = listQueryFromSearch(new URLSearchParams('open=1'));
    expect(mineOpen).toEqual(expect.objectContaining({ scope: 'me', open: true }));
    expect(mineOpen.pending_my_approval).toBeUndefined();
    expect(mineOpen.expiring).toBeUndefined();
    expect(listQueryFromSearch(new URLSearchParams('open=1&scope=all'))).toEqual(
      expect.objectContaining({ scope: 'all', open: true }),
    );
  });

  it('maps chips to list API query keys', () => {
    expect(listQueryFromSearch(new URLSearchParams('chip=pending'))).toEqual(
      expect.objectContaining({ pending_my_approval: true }),
    );
    expect(listQueryFromSearch(new URLSearchParams('chip=expiring'))).toEqual(
      expect.objectContaining({ expiring: true }),
    );
    expect(listQueryFromSearch(new URLSearchParams('chip=sent'))).toEqual(
      expect.objectContaining({ status: 'sent' }),
    );
    expect(listQueryFromSearch(new URLSearchParams('chip=mine'))).toEqual(
      expect.objectContaining({ scope: 'me' }),
    );
  });
});
