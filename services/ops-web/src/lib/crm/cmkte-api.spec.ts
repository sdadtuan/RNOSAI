import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE } from '@/lib/api';
import {
  convertPortfolioRequest,
  fetchCommandCenter,
  fetchPortfolioApprovals,
  fetchPortfolioItem,
  fetchPortfolioPublications,
  fetchPortfolioRequests,
  filterCommandCenter,
  mapIntakeRows,
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
