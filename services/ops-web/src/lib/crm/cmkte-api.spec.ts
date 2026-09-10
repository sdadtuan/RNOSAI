import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE } from '@/lib/api';
import { convertPortfolioRequest, fetchCommandCenter, fetchPortfolioRequests } from './cmkte-api';

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

describe('fetchPortfolioRequests', () => {
  it('GETs portfolio requests with Bearer token', async () => {
    const body = { items: [] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPortfolioRequests('tok-9');

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/crm/content-os/portfolio/requests`, {
      headers: { Authorization: 'Bearer tok-9' },
    });
    expect(result).toEqual(body);
  });

  it('returns empty items when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'nope' }),
      }),
    );

    await expect(fetchPortfolioRequests('tok-9')).resolves.toEqual({ items: [] });
  });
});

describe('convertPortfolioRequest', () => {
  it('POSTs convert and returns item id', async () => {
    const body = { request: { id: 9 }, item: { id: 55 } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await convertPortfolioRequest('tok-9', 9);

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/crm/content-os/portfolio/requests/9/convert`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok-9',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    expect(result).toEqual(body);
  });
});
