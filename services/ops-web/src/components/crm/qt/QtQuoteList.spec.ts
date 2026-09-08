import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildQtListSearchParams } from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';
import {
  QT_LIST_CHIPS,
  QT_LIST_LOST_REASONS,
  QT_OPEN_LIST_STATUSES,
  QtListChips,
  QtListPager,
  QtQuoteTable,
  QtRejectModal,
  activeListChip,
  canRejectQuote,
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

  it('open=1 sends draft…negotiation so accepted/expired stay out', () => {
    expect(QT_OPEN_LIST_STATUSES).toEqual([
      'draft',
      'in_review',
      'pending_approval',
      'returned',
      'approved',
      'sent',
      'viewed',
      'negotiation',
    ]);
    const mineOpen = listQueryFromSearch(new URLSearchParams('open=1'));
    const sent = buildQtListSearchParams(mineOpen);
    expect(sent.get('open')).toBe('1');
    expect(sent.get('status')?.split(',')).toEqual([...QT_OPEN_LIST_STATUSES]);
    expect(sent.get('status')).not.toMatch(/accepted|expired/);
  });

  it('maps chips to list API query keys', () => {
    expect(listQueryFromSearch(new URLSearchParams('chip=pending'))).toEqual(
      expect.objectContaining({ pending_my_approval: true }),
    );
    expect(listQueryFromSearch(new URLSearchParams('chip=expiring'))).toEqual(
      expect.objectContaining({ expiring: true }),
    );
    expect(listQueryFromSearch(new URLSearchParams('chip=sent'))).toEqual(
      expect.objectContaining({ status: 'sent,viewed' }),
    );
    expect(activeListChip(new URLSearchParams('status=sent,viewed'))).toBe('sent');
    expect(listQueryFromSearch(new URLSearchParams('chip=mine'))).toEqual(
      expect.objectContaining({ scope: 'me' }),
    );
    expect(buildQtListSearchParams(listQueryFromSearch(new URLSearchParams('chip=sent'))).get('status')).toBe(
      'sent,viewed',
    );
  });
});

describe('LST-01 lost-reason reject modal', () => {
  it('exposes lost_reason enum budget|competitor|priority|scope|other on rejectable rows', () => {
    expect(QT_LIST_LOST_REASONS).toEqual(['budget', 'competitor', 'priority', 'scope', 'other']);
    expect(canRejectQuote('sent')).toBe(true);
    expect(canRejectQuote('viewed')).toBe(true);
    expect(canRejectQuote('accepted')).toBe(false);

    const table = renderToStaticMarkup(
      createElement(QtQuoteTable, {
        items: [{ ...EMPTY_ROW, id: 9, quote_code: 'QT-PTT-2026-000009', status: 'sent' }],
        onReject: () => {},
      }),
    );
    expect(table).toMatch(/Từ chối|lost_reason/i);
    expect(table).toContain('qt-btn');

    const modal = renderToStaticMarkup(
      createElement(QtRejectModal, {
        quoteCode: 'QT-PTT-2026-000009',
        lostReason: '',
        onLostReason: () => {},
        onConfirm: () => {},
        onClose: () => {},
      }),
    );
    expect(modal).toMatch(/lost_reason|Lý do thua/i);
    expect(modal).toContain('budget');
    expect(modal).toContain('competitor');
    expect(modal).toContain('priority');
    expect(modal).toContain('scope');
    expect(modal).toContain('other');
    expect(modal).toContain('qt-card');
  });
});

describe('list pagination', () => {
  it('disables prev on first page and next on last page', () => {
    const first = renderToStaticMarkup(
      createElement(QtListPager, { page: 1, pageSize: 25, total: 50, onPrev: () => {}, onNext: () => {} }),
    );
    expect(first).toMatch(/<button[^>]*disabled[^>]*>\s*Trước/);
    expect(first).not.toMatch(/<button[^>]*disabled[^>]*>\s*Sau/);

    const last = renderToStaticMarkup(
      createElement(QtListPager, { page: 2, pageSize: 25, total: 50, onPrev: () => {}, onNext: () => {} }),
    );
    expect(last).toMatch(/<button[^>]*disabled[^>]*>\s*Sau/);
    expect(last).not.toMatch(/<button[^>]*disabled[^>]*>\s*Trước/);
  });
});
