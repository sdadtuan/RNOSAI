import { describe, expect, it } from 'vitest';
import { leadSignalKpis } from './lead-signal-kpis';

const now = new Date('2026-08-25T12:00:00.000Z');

describe('leadSignalKpis', () => {
  it('counts four work signals in demo order', () => {
    const kpis = leadSignalKpis(
      [
        { ai_band: 'hot', status: 'moi', received_at: '2026-08-24T00:00:00.000Z', created_at: '2026-08-24T00:00:00.000Z' },
        { ai_band: 'warm', status: 'dang_tu_van', received_at: '2026-08-20T00:00:00.000Z', created_at: '2026-08-20T00:00:00.000Z' },
        { ai_band: null, status: 'bao_gia', received_at: '2026-08-22T00:00:00.000Z', created_at: '2026-08-22T00:00:00.000Z' },
        { ai_band: null, status: 'won', received_at: '2026-08-24T00:00:00.000Z', created_at: '2026-08-01T00:00:00.000Z' },
        { ai_band: null, status: 'won', received_at: '2026-08-01T00:00:00.000Z', created_at: '2026-08-01T00:00:00.000Z' },
      ],
      now,
    );
    expect(kpis.map((k) => [k.key, k.label, k.count])).toEqual([
      ['hot', 'Nóng — gọi ngay', 1],
      ['consult', 'Chờ tư vấn', 1],
      ['ai', 'AI đề xuất', 1],
      ['won', 'Won tuần này', 1],
    ]);
  });

  it('returns zeros for empty rows', () => {
    expect(leadSignalKpis([], now).every((k) => k.count === 0)).toBe(true);
  });
});
