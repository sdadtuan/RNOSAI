import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE } from '@/lib/api';
import {
  AI_TRACE_EMPTY,
  fetchPortfolioAiTraces,
  formatAiTraceSources,
  loadAiTracePanel,
  mapAiTraceDisplay,
  resetAiTracePanelView,
  shouldFetchAiTraces,
  shouldShowAiTracePanel,
} from './cmkte-ai-traces';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formatAiTraceSources', () => {
  it('joins ids and patterns and uses — when empty', () => {
    expect(formatAiTraceSources([])).toBe('—');
    expect(formatAiTraceSources([{ id: 11, pattern: 'hook-pain' }, { id: 12, pattern: 'proof' }])).toBe(
      '#11 hook-pain, #12 proof',
    );
  });
});

describe('mapAiTraceDisplay', () => {
  it('lists time, intent, sources and never surfaces a prompt dump', () => {
    const row = {
      at: '2026-09-10T08:01:00.000Z',
      intent: 'Draft generate',
      sources: [{ id: 11, pattern: 'hook-pain' }],
      job_id: 55,
      status: 'succeeded',
      run_id: 'run-1',
      prompt: 'RAW PROMPT',
      input_json: { system_prompt: 'hidden' },
    };
    const view = mapAiTraceDisplay(row as never);
    expect(view).toEqual({
      time: '2026-09-10T08:01:00.000Z',
      intent: 'Draft generate',
      sources: '#11 hook-pain',
    });
    expect(JSON.stringify(view)).not.toMatch(/RAW PROMPT|system_prompt|input_json/);
  });

  it('uses — for missing intent and sources', () => {
    expect(
      mapAiTraceDisplay({
        at: '',
        intent: '',
        sources: [],
        job_id: 1,
        status: 'queued',
      }),
    ).toEqual({ time: '—', intent: '—', sources: '—' });
  });
});

describe('shouldFetchAiTraces / shouldShowAiTracePanel', () => {
  it('skips fetch when generate cap is known false', () => {
    expect(shouldFetchAiTraces(false)).toBe(false);
    expect(shouldShowAiTracePanel({ canGenerate: false })).toBe(false);
  });

  it('fetches when there is no cap signal and hides after 403', () => {
    expect(shouldFetchAiTraces(null)).toBe(true);
    expect(shouldShowAiTracePanel({ canGenerate: null, forbidden: false })).toBe(true);
    expect(shouldShowAiTracePanel({ canGenerate: null, forbidden: true })).toBe(false);
  });
});

describe('fetchPortfolioAiTraces', () => {
  it('GETs item ai-traces with optional lifecycle hint', async () => {
    const body = { items: [{ at: '2026-09-10T08:01:00.000Z', intent: 'Draft generate', sources: [], job_id: 55, status: 'succeeded' }] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPortfolioAiTraces('tok-9', 21, 4);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/crm/content-os/portfolio/items/21/ai-traces?lifecycle=4`,
      { headers: { Authorization: 'Bearer tok-9' } },
    );
    expect(result).toEqual({ items: body.items, forbidden: false });
  });

  it('treats 403 as empty traces and forbidden', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'missing_cap' }),
      }),
    );
    await expect(fetchPortfolioAiTraces('tok-9', 21)).resolves.toEqual({ items: [], forbidden: true });
  });

  it('returns empty items when the item has no jobs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      }),
    );
    await expect(fetchPortfolioAiTraces('tok-9', 21)).resolves.toEqual({ items: [], forbidden: false });
  });
});

describe('AI_TRACE_EMPTY', () => {
  it('uses the Copy Studio empty copy', () => {
    expect(AI_TRACE_EMPTY).toBe('Chưa có AI trace');
  });
});

describe('AI trace panel item change / fetch rejection', () => {
  it('clears traces and forbidden immediately so a previous item is not shown', () => {
    expect(resetAiTracePanelView()).toEqual({ items: [], forbidden: false });
  });

  it('hides the panel when fetch rejects with 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(Object.assign(new Error('forbidden'), { status: 403 })),
    );
    await expect(loadAiTracePanel('tok-9', 22)).resolves.toEqual({ items: [], forbidden: true });
  });

  it('shows an empty list when fetch rejects for a non-403 error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(loadAiTracePanel('tok-9', 22)).resolves.toEqual({ items: [], forbidden: false });
  });
});
