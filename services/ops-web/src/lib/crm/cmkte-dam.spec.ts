import { describe, expect, it } from 'vitest';
import {
  DAM_EMPTY_COLLECTION_COPY,
  DAM_PICK_LABEL,
  canBindDamUrl,
  readDamListResult,
} from './cmkte-dam';

describe('cmkte-dam', () => {
  it('keeps the Library picker label exact', () => {
    expect(DAM_PICK_LABEL).toBe('Chọn từ DAM');
  });

  it('uses empty-success copy that is not an error', () => {
    expect(DAM_EMPTY_COLLECTION_COPY).toBe('Chưa có asset trong collection');
  });

  it('does not bind javascript, data, http, or foreign hosts', () => {
    expect(canBindDamUrl('javascript:alert(1)', 'dam.example.internal')).toBe(false);
    expect(canBindDamUrl('data:text/plain,x', 'dam.example.internal')).toBe(false);
    expect(canBindDamUrl('http://dam.example.internal/a.jpg', 'dam.example.internal')).toBe(false);
    expect(canBindDamUrl('https://evil.example/a.jpg', 'dam.example.internal')).toBe(false);
    expect(canBindDamUrl('https://dam.example.internal/a.jpg', 'dam.example.internal')).toBe(true);
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

  it('treats an items array with any malformed row as dam_invalid_response, not silent empty success', () => {
    const allRejected = readDamListResult({
      items: [
        { id: 'missing', access_token: 'sk_live_abc' },
        { filename: 'no-url.jpg' },
      ],
    });
    expect(allRejected).toEqual({ items: [], error: 'dam_invalid_response' });
    expect(JSON.stringify(allRejected)).not.toMatch(/sk_live|token|secret/i);

    expect(
      readDamListResult({
        items: [
          { id: 'ok', url: 'https://dam.example/ok.jpg' },
          { id: 'bad' },
        ],
      }),
    ).toEqual({ items: [], error: 'dam_invalid_response' });
  });
});
