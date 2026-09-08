import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dash } from '@/lib/crm/qt-format';
import { QT_APPROVAL_CHIPS, QtApprovalsInbox } from './QtApprovals';

const FORBIDDEN = ['sẽ có ở W2', 'mở ở Wave', 'NOVA', 'Nhảy màn', '265.647.600', '22,4'];

describe('QtApprovalsInbox', () => {
  it('renders APR-01 chips and an empty table of dashes', () => {
    expect(QT_APPROVAL_CHIPS.map((chip) => chip.label)).toEqual([
      'Chờ tôi',
      'Đã xử lý',
      'SLA vỡ',
    ]);

    const html = renderToStaticMarkup(createElement(QtApprovalsInbox, { items: [] }));

    expect(html).toContain('Hộp thư phê duyệt');
    expect(html).toContain('Quote');
    expect(html).toContain('Trigger');
    expect(html).toContain('Bước');
    expect(html).toContain('SLA');
    expect(html).toContain('Owner');
    expect(html).toContain(dash(null));
    expect(html).toContain('qt-table');
    expect(html).not.toContain('<main');
    for (const banned of FORBIDDEN) {
      expect(html).not.toContain(banned);
    }
  });
});
