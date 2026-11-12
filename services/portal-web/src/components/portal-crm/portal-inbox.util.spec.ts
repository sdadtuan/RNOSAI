import { describe, it, expect } from 'vitest';
import { displayPageName, displayVnPhone, extractContacts, relativeTime, slashQuery, splitMedia } from './portal-inbox.util';

describe('portal-inbox.util', () => {
  it('normalizes +84 phones and extracts emails', () => {
    expect(displayVnPhone('+84912345678')).toBe('0912345678');
    const found = extractContacts('Gọi +84 912 345 678 — mail a@ptt.vn');
    expect(found.phones).toEqual(['0912345678']);
    expect(found.emails).toEqual(['a@ptt.vn']);
  });

  it('splits image urls from a message body', () => {
    const body = 'Xem ảnh https://cdn.example.com/a.jpg nhé';
    const split = splitMedia(body);
    expect(split.images).toEqual(['https://cdn.example.com/a.jpg']);
    expect(split.text).toContain('Xem ảnh');
  });

  it('detects a / shortcut at the start of the last token', () => {
    expect(slashQuery('/chao')).toEqual({ start: 0, query: 'chao' });
    expect(slashQuery('xin /sdt')).toEqual({ start: 4, query: 'sdt' });
    expect(slashQuery('giá /')).toEqual({ start: 4, query: '' });
    expect(slashQuery('https://x.com')).toBeNull();
  });

  it('formats a time from a few minutes ago as phút', () => {
    const now = new Date('2026-11-12T08:10:00+07:00');
    const at = new Date('2026-11-12T08:05:00+07:00').toISOString();
    expect(relativeTime(at, now)).toBe('5 phút');
  });

  it('shows a Page name, or Page …last4 when only a raw id is known', () => {
    expect(displayPageName('1306726262522472', 'PTT Advertising Solutions')).toBe('PTT Advertising Solutions');
    expect(displayPageName('1306726262522472', '')).toBe('Page …2472');
    expect(displayPageName('1306726262522472', '1306726262522472')).toBe('Page …2472');
    expect(displayPageName('1429627217292841')).toBe('Page …2841');
  });
});
