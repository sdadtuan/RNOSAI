import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dash } from '@/lib/crm/qt-format';
import { QT_STUDIO_PUBLISH_REASON, QT_STUDIO_SECTIONS, QtStudioChrome } from './QtStudio';

const FORBIDDEN = ['sẽ có ở W2', 'mở ở Wave', 'NOVA', 'Nhảy màn', '265.647.600'];

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
    expect(html).not.toContain('<main');
    for (const banned of FORBIDDEN) {
      expect(html).not.toContain(banned);
    }
  });
});
