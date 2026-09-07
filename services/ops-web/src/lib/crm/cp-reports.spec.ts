import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportCpReport, getCpReport } from './cp-api';
import {
  CP_REPORT_FILTERS,
  CP_REPORT_SECTIONS,
  CP_REPORT_TABS,
  MISSING_INGEST_COPY,
  dash,
  sourcedDisplay,
} from './cp-format';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CP report API', () => {
  it('loads a report slug under /reports/:slug', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        slug: 'performance',
        metrics: {
          views: { value: null, source: 'chưa ingest', freshness: null },
          ctr: { value: null, source: 'chưa ingest', freshness: null },
        },
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const report = await getCpReport('token', 'performance', { scope: 'me' });

    expect(report.slug).toBe('performance');
    expect(report.metrics.ctr.value).toBeNull();
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/reports/performance?scope=me'),
    );
  });

  it('exports a report under POST /reports/export', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, slug: 'governance', format: 'csv' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await exportCpReport('token', { slug: 'governance', format: 'csv' }, 'team');

    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/reports/export?scope=team'),
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('sourcedDisplay', () => {
  it('renders missing ingest as an em dash plus Thiếu nguồn', () => {
    const shown = sourcedDisplay({ value: null, source: 'chưa ingest', freshness: null });
    expect(shown.value).toBe('—');
    expect(shown.missing).toBe(true);
    expect(MISSING_INGEST_COPY).toBe('Thiếu nguồn');
  });
});

describe('CP_REPORT_TABS', () => {
  it('lists the five RPT slugs without changing overview tiles', () => {
    expect(CP_REPORT_TABS.map((tab) => tab.slug)).toEqual([
      'executive',
      'production',
      'credit',
      'performance',
      'governance',
    ]);
  });
});

describe('report filters and empty sections', () => {
  it('sends from/to/client on every slug including performance ingest', async () => {
    const slugs = ['executive', 'production', 'credit', 'performance', 'governance'] as const;
    for (const slug of slugs) {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ slug }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      await getCpReport('token', slug, {
        scope: 'me',
        from: '2026-09-01',
        to: '2026-09-07',
        client: 'client-1',
      });

      const url = String(fetchMock.mock.calls[0]?.[0] ?? '');
      expect(url).toContain(`/reports/${slug}?`);
      expect(url).toContain('from=2026-09-01');
      expect(url).toContain('to=2026-09-07');
      expect(url).toContain('client=client-1');
      expect(url).not.toContain('lifecycle=');
      expect(url).not.toContain('channel=');
    }
  });

  it('keeps required sections visible as an em dash when empty', () => {
    expect(dash(null)).toBe('—');
    expect(CP_REPORT_SECTIONS.executive).toEqual(['trend', 'top_creative', 'project_health']);
    expect(CP_REPORT_SECTIONS.production).toEqual(['heatmap', 'provider_health']);
    expect(CP_REPORT_SECTIONS.credit).toEqual(['by_pipeline']);
    expect(CP_REPORT_FILTERS).toEqual(['from', 'to', 'client']);
  });
});
