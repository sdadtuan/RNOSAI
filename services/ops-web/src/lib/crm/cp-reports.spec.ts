import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportCpReport, getCpReport } from './cp-api';
import { CP_REPORT_TABS, MISSING_INGEST_COPY, sourcedDisplay } from './cp-format';

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
