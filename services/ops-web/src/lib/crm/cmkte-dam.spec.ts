import { describe, expect, it } from 'vitest';
import { DAM_PICK_LABEL, readDamListResult } from './cmkte-dam';

describe('cmkte-dam', () => {
  it('keeps the Library picker label exact', () => {
    expect(DAM_PICK_LABEL).toBe('Chọn từ DAM');
  });

  it('maps fail to empty list plus a stable code and does not invent Sunlight/Nova assets', () => {
    const failed = readDamListResult(
      {
        items: [{ id: 'sun-1', url: 'https://cdn.example/sunlight.jpg', filename: 'Sunlight Hero' }],
        error: 'ECONNREFUSED',
      },
      'dam_unavailable',
    );
    expect(failed).toEqual({ items: [], error: 'dam_unavailable' });
    expect(JSON.stringify(failed)).not.toMatch(/Sunlight|Nova|ECONNREFUSED/i);
  });

  it('uses a stable fallback code when the body is unreadable on HTTP fail', () => {
    expect(readDamListResult(null, 'dam_unavailable')).toEqual({
      items: [],
      error: 'dam_unavailable',
    });
  });

  it('treats HTTP 200 with invalid JSON or a missing items array as dam_invalid_response', () => {
    expect(readDamListResult(null)).toEqual({ items: [], error: 'dam_invalid_response' });
    expect(readDamListResult({ ok: true })).toEqual({ items: [], error: 'dam_invalid_response' });
    expect(readDamListResult({ items: { vendor: 'dump' } })).toEqual({
      items: [],
      error: 'dam_invalid_response',
    });
  });

  it('keeps URL metadata on success and strips secrets', () => {
    const ok = readDamListResult({
      items: [
        {
          id: 'asset-1',
          url: 'https://dam.example/files/hero.jpg',
          collection: 'approved',
          filename: 'hero.jpg',
          access_token: 'secret-token',
        },
      ],
    });
    expect(ok).toEqual({
      items: [
        {
          id: 'asset-1',
          url: 'https://dam.example/files/hero.jpg',
          collection: 'approved',
          filename: 'hero.jpg',
        },
      ],
    });
    expect(JSON.stringify(ok)).not.toMatch(/token|secret/i);
  });
});
