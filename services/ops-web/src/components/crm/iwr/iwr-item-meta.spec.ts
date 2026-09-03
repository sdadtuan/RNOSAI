import { describe, expect, it } from 'vitest';
import {
  clampProgress,
  formatViYmd,
  isOverdueYmd,
  parseIwrItemMeta,
  serializeIwrItemMeta,
} from './iwr-item-meta';

describe('iwr-item-meta', () => {
  it('round-trips structured body and keeps legacy plain text', () => {
    const body = serializeIwrItemMeta({ project: 'Spa ABC', progress: 70, text: 'xong' });
    expect(parseIwrItemMeta(body)).toMatchObject({ project: 'Spa ABC', progress: 70, text: 'xong' });
    expect(parseIwrItemMeta('Chờ khách chốt')).toMatchObject({ text: 'Chờ khách chốt', note: 'Chờ khách chốt' });
  });

  it('formats date and detects overdue', () => {
    expect(formatViYmd('2026-09-03')).toBe('03/09/2026');
    expect(clampProgress(140)).toBe(100);
    expect(isOverdueYmd('2026-09-01', new Date('2026-09-03T10:00:00+07:00'))).toBe(true);
    expect(isOverdueYmd('2026-09-05', new Date('2026-09-03T10:00:00+07:00'))).toBe(false);
  });
});
