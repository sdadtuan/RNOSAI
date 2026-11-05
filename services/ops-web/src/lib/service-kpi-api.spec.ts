import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchServiceKpiTemplates } from './service-kpi-api';

describe('service-kpi-api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetchServiceKpiTemplates returns items list', async () => {
    const body = {
      items: [{ id: 'tpl-1', name: 'Meta Ads Performance', status: 'IN_REVIEW', dv_code: 'DV04' }],
      total: 1,
      summary: { active: 0, in_review: 1 },
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(body),
      json: async () => body,
    } as Response);

    const res = await fetchServiceKpiTemplates('token');
    expect(res.items[0]?.name).toBe('Meta Ads Performance');
    expect(res.summary.in_review).toBe(1);
  });
});
