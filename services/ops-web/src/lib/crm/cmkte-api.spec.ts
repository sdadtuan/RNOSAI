import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE } from '@/lib/api';
import {
  approvePortfolioInsight,
  convertPortfolioRequest,
  fetchCommandCenter,
  fetchPortfolioApprovals,
  fetchPortfolioInsights,
  fetchPortfolioItem,
  fetchPortfolioPublications,
  fetchPortfolioSlaEvents,
  fetchDamAssets,
  fetchPortfolioSettings,
  fetchPortfolioRequests,
  patchPortfolioSettings,
  filterCommandCenter,
  mapIntakeRows,
  postPortfolioApprovalsBatch,
  type PortfolioCommandCenter,
  type PortfolioContentRequest,
} from './cmkte-api';

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

  it('passes ?lifecycle= as a hint and does not drop the filter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        throughput_week: 1,
        completed_week: 0,
        wip: 1,
        sla_at_risk: 0,
        sla_breached: 0,
        first_pass_pct: null,
        capacity_pct: null,
        blocked: 0,
        risk_queue: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchCommandCenter('tok-9', 4);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/crm/content-os/portfolio/command-center?lifecycle=4`,
      { headers: { Authorization: 'Bearer tok-9' } },
    );
  });
});

describe('filterCommandCenter', () => {
  const center: PortfolioCommandCenter = {
    throughput_week: 2,
    completed_week: 1,
    wip: 1,
    sla_at_risk: 0,
    sla_breached: 0,
    first_pass_pct: null,
    capacity_pct: null,
    blocked: 0,
    risk_queue: [
      {
        item_id: 21,
        lifecycle_id: 4,
        content_code: 'CNT-1',
        title: 'A',
        client_label: 'Acme',
        risk_signal: 'sla',
        owner_label: 'am',
        sla_remaining_h: 2,
        recommended_action: 'Approve',
      },
      {
        item_id: 22,
        lifecycle_id: 7,
        content_code: 'CNT-2',
        title: 'B',
        client_label: 'Beta',
        risk_signal: 'blocked',
        owner_label: 'sp',
        sla_remaining_h: 1,
        recommended_action: 'Unblock',
      },
    ],
  };

  it('filters the risk queue to the hinted lifecycle and keeps other tiles', () => {
    expect(filterCommandCenter(center, 4).risk_queue.map((row) => row.item_id)).toEqual([21]);
    expect(filterCommandCenter(center, 4).throughput_week).toBe(2);
    expect(filterCommandCenter(center).risk_queue).toHaveLength(2);
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

describe('mapIntakeRows', () => {
  const request = {
    id: 9,
    lifecycle_id: 4,
    display_code: 'CR-20260910-001',
    source: 'account',
    requester_email: 'am@ptt.vn',
    client_label: 'Acme',
    brand_label: 'Brand',
    deliverable_ask: '12 social posts',
    objective: 'Awareness',
    due_at: '2026-09-20',
    priority: 'High',
    risk_level: 'normal',
    completeness: 100,
    effort_h: 2,
    tier: 'S',
    triage_status: 'Accepted',
    idea_id: null,
    created_by: 'am@ptt.vn',
    created_at: '2026-09-10T00:00:00.000Z',
    updated_at: '2026-09-10T00:00:00.000Z',
  } satisfies PortfolioContentRequest;

  it('shows idea items from GET without a lifecycle query', () => {
    const ideaItem = {
      ...request,
      id: 3,
      display_code: 'IDEA-3',
      kind: 'idea' as const,
      source: 'idea',
      client_label: '',
      brand_label: '',
      deliverable_ask: 'Hook idea',
      objective: 'Reach',
      triage_status: 'backlog',
      idea_id: 3,
      completeness: 0,
      effort_h: null,
      tier: null,
      risk_level: '',
    };
    const rows = mapIntakeRows([request, ideaItem]);
    const idea = rows.find((row) => row.kind === 'idea');
    expect(idea).toMatchObject({
      kind: 'idea',
      deliverable: 'Hook idea',
      canConvert: false,
      requestId: null,
    });
    expect(rows.find((row) => row.source === 'account')?.canConvert).toBe(true);
  });

  it('allows convert for Accepted CR rows even when source is idea', () => {
    const ideaSourcedRequest = {
      ...request,
      id: 12,
      display_code: 'CR-20260910-012',
      kind: 'request' as const,
      source: 'idea',
      triage_status: 'Accepted',
      idea_id: 3,
    };
    const rows = mapIntakeRows([ideaSourcedRequest]);
    expect(rows[0]).toMatchObject({
      kind: 'request',
      source: 'idea',
      canConvert: true,
      requestId: 12,
    });
  });

  it('blocks convert for synthetic IDEA rows', () => {
    const syntheticIdea = {
      ...request,
      id: 3,
      display_code: 'IDEA-3',
      kind: 'idea' as const,
      source: 'idea',
      triage_status: 'Accepted',
      idea_id: 3,
      client_label: '',
      brand_label: '',
      completeness: 0,
      effort_h: null,
      tier: null,
      risk_level: '',
    };
    const rows = mapIntakeRows([syntheticIdea]);
    expect(rows[0]).toMatchObject({
      kind: 'idea',
      canConvert: false,
      requestId: null,
    });
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

describe('fetchPortfolioItem', () => {
  it('GETs portfolio item with optional lifecycle hint', async () => {
    const body = { id: 21, lifecycle_id: 4, title: 'Master story' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPortfolioItem('tok-9', 21, 4);

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/crm/content-os/portfolio/items/21?lifecycle=4`, {
      headers: { Authorization: 'Bearer tok-9' },
    });
    expect(result).toEqual(body);
  });

  it('throws when item is not in staff scope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'item_not_found' }),
      }),
    );

    await expect(fetchPortfolioItem('tok-9', 21)).rejects.toThrow('item_not_found');
  });
});

describe('fetchPortfolioApprovals', () => {
  it('GETs portfolio approvals with Bearer token', async () => {
    const body = { items: [{ id: 21, lifecycle_id: 4, title: 'Master' }] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPortfolioApprovals('tok-9');

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/crm/content-os/portfolio/approvals`, {
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

    await expect(fetchPortfolioApprovals('tok-9')).resolves.toEqual({ items: [] });
  });
});

describe('postPortfolioApprovalsBatch', () => {
  it('POSTs selected item ids to portfolio approvals/batch', async () => {
    const body = { ok: [21], failed: [] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await postPortfolioApprovalsBatch('tok-9', [21, 22], 'in_review');

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/crm/content-os/portfolio/approvals/batch`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok-9',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ item_ids: [21, 22], step: 'in_review' }),
    });
    expect(result).toEqual(body);
  });
});

describe('fetchPortfolioInsights', () => {
  it('GETs portfolio insights with optional lifecycle hint', async () => {
    const body = { items: [{ id: 11, status: 'Draft', pattern: 'hook' }] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPortfolioInsights('tok-9', 4);

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/crm/content-os/portfolio/insights?lifecycle=4`, {
      headers: { Authorization: 'Bearer tok-9' },
    });
    expect(result).toEqual(body);
  });

  it('throws when the insights response is not ok instead of returning an empty list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'nope' }),
      }),
    );
    await expect(fetchPortfolioInsights('tok-9', 4)).rejects.toThrow();
  });
});

describe('approvePortfolioInsight', () => {
  it('POSTs insight approve', async () => {
    const body = { id: 11, status: 'Approved' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await approvePortfolioInsight('tok-9', 11);

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/crm/content-os/portfolio/insights/11/approve`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok-9',
        'Content-Type': 'application/json',
      },
    });
    expect(result).toEqual(body);
  });
});

describe('fetchPortfolioPublications', () => {
  it('GETs portfolio publications with Bearer token', async () => {
    const body = { slots: [{ id: 3, item_id: 21, scheduled_at: '2026-09-14T10:00:00.000Z' }] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPortfolioPublications('tok-9');

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/crm/content-os/portfolio/publications`, {
      headers: { Authorization: 'Bearer tok-9' },
    });
    expect(result).toEqual(body);
  });

  it('returns empty slots when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'nope' }),
      }),
    );

    await expect(fetchPortfolioPublications('tok-9')).resolves.toEqual({ slots: [] });
  });
});

describe('fetchPortfolioSlaEvents', () => {
  it('GETs portfolio sla-events with optional item_id and am_staff_id', async () => {
    const body = { items: [{ id: 1, item_id: 21, action: 'breached' }] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPortfolioSlaEvents('tok-9', { itemId: 21, amStaffId: 11 });

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/crm/content-os/portfolio/sla-events?item_id=21&am_staff_id=11`,
      { headers: { Authorization: 'Bearer tok-9' } },
    );
    expect(result).toEqual(body);
  });

  it('returns empty items when none', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      }),
    );
    await expect(fetchPortfolioSlaEvents('tok-9')).resolves.toEqual({ items: [] });
  });
});

describe('fetchDamAssets', () => {
  it('GETs portfolio dam with collection and Bearer token', async () => {
    const body = {
      items: [{ id: 'asset-1', url: 'https://dam.example/files/hero.jpg', collection: 'approved' }],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchDamAssets('tok-9', 'approved');

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/crm/content-os/portfolio/dam?collection=approved`,
      { headers: { Authorization: 'Bearer tok-9' } },
    );
    expect(result).toEqual(body);
  });

  it('maps HTTP fail to empty list plus error and does not invent DAM assets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'dam_unavailable', items: [{ filename: 'Nova Hero' }] }),
      }),
    );
    const result = await fetchDamAssets('tok-9');
    expect(result).toEqual({ items: [], error: 'dam_unavailable' });
    expect(JSON.stringify(result)).not.toMatch(/Sunlight|Nova/i);
  });

  it('maps network fail to empty list plus a stable code, not the raw exception', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Failed to fetch token=sk_live_abc')),
    );
    const result = await fetchDamAssets('tok-9', 'approved');
    expect(result).toEqual({ items: [], error: 'dam_unavailable' });
    expect(JSON.stringify(result)).not.toMatch(/Failed to fetch|sk_live|token=/i);
  });

  it('maps HTTP 200 with invalid JSON to empty list plus dam_invalid_response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      }),
    );
    await expect(fetchDamAssets('tok-9')).resolves.toEqual({
      items: [],
      error: 'dam_invalid_response',
    });
  });
});

describe('portfolio settings', () => {
  it('GET settings defaults direct_social_publish to false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ direct_social_publish: false }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchPortfolioSettings('tok-9')).resolves.toEqual({
      direct_social_publish: false,
      sso_enforced: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/crm/content-os/portfolio/settings`, {
      headers: { Authorization: 'Bearer tok-9' },
    });
  });

  it('throws on a failed GET so auth or HTTP errors are not a false disabled policy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'settings_unavailable' }),
      }),
    );
    await expect(fetchPortfolioSettings('tok-9')).rejects.toThrow('settings_unavailable');
  });

  it('throws on 401 instead of returning a false disabled policy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'unauthorized' }),
      }),
    );
    await expect(fetchPortfolioSettings('tok-9')).rejects.toThrow('unauthorized');
  });

  it('PATCH settings persists direct_social_publish', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ direct_social_publish: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(patchPortfolioSettings('tok-9', { direct_social_publish: true })).resolves.toEqual({
      direct_social_publish: true,
      sso_enforced: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/crm/content-os/portfolio/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer tok-9',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ direct_social_publish: true }),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).not.toHaveProperty('sso_enforced');
  });

  it('GET settings exposes sso_enforced false when the payload omits it (no IdP)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ direct_social_publish: false }),
      }),
    );
    await expect(fetchPortfolioSettings('tok-9')).resolves.toEqual({
      direct_social_publish: false,
      sso_enforced: false,
    });
  });

  it('GET settings maps sso_enforced true from staff IdP without leaking secrets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ direct_social_publish: false, sso_enforced: true }),
      }),
    );
    const settings = await fetchPortfolioSettings('tok-9');
    expect(settings).toEqual({
      direct_social_publish: false,
      sso_enforced: true,
    });
    expect(JSON.stringify(settings)).not.toMatch(/issuer|secret|client_secret|private.?key/i);
  });
});
