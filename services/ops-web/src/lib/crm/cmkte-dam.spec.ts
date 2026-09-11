import { describe, expect, it } from 'vitest';
import { DAM_PICK_LABEL, readDamListResult } from './cmkte-dam';

describe('cmkte-dam', () => {
  it('keeps the Library picker label exact', () => {
    expect(DAM_PICK_LABEL).toBe('Chọn từ DAM');
  });

  it('maps fail to empty list plus error and does not invent Sunlight/Nova assets', () => {
    const failed = readDamListResult(
      {
        items: [{ id: 'sun-1', url: 'https://cdn.example/sunlight.jpg', filename: 'Sunlight Hero' }],
        error: 'ECONNREFUSED',
      },
      'dam_list_failed',
    );
    expect(failed).toEqual({ items: [], error: 'ECONNREFUSED' });
    expect(JSON.stringify(failed)).not.toMatch(/Sunlight|Nova/i);
  });

  it('uses the fallback error string when the body is unreadable', () => {
    expect(readDamListResult(null, 'dam_list_failed')).toEqual({
      items: [],
      error: 'dam_list_failed',
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
