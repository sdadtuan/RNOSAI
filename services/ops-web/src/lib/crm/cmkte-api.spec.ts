import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE } from '@/lib/api';
import { fetchCommandCenter } from './cmkte-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCommandCenter', () => {
  it('GETs portfolio command-center with Bearer token', async () => {
    const body = {
      throughput_week: 3,
      completed_week: 1,
      wip: 2,
      sla_at_risk: 1,
      sla_breached: 0,
      first_pass_pct: null,
      capacity_pct: null,
      blocked: 0,
      risk_queue: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCommandCenter('tok-9');

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/crm/content-os/portfolio/command-center`, {
      headers: { Authorization: 'Bearer tok-9' },
    });
    expect(result).toEqual(body);
  });

  it('throws Vietnamese error when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'nope' }),
      }),
    );

    await expect(fetchCommandCenter('tok-9')).rejects.toThrow('Không tải được Command Center');
  });
});
