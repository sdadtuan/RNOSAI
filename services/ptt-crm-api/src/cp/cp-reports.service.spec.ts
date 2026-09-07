import { CpReportsService } from './cp-reports.service';

function emptyDb() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };
}

function makeService(db = emptyDb(), audit = { insert: jest.fn().mockResolvedValue(undefined) }) {
  return {
    svc: new CpReportsService(db as never, audit as never),
    db,
    audit,
  };
}

type Sourced = { value: number | null; source: string; freshness: string | null };
type PerformanceOut = {
  slug: string;
  metrics: Record<string, Sourced>;
  funnel: unknown;
};
type ExecutiveOut = {
  funnel: unknown;
  kpis: { roi: Sourced };
};
type CreditOut = {
  forecast: { value: number | null; assumption: string };
};

describe('CpReportsService performance', () => {
  it('returns null value with source and freshness when ingest is missing', async () => {
    const { svc } = makeService();
    const out = await svc.get('performance', { scope: 'me', staffId: 1 }) as PerformanceOut;

    expect(out.slug).toBe('performance');
    for (const metric of Object.values(out.metrics)) {
      expect(metric).toEqual(
        expect.objectContaining({
          value: null,
          source: expect.any(String),
          freshness: null,
        }),
      );
    }
    expect(out.metrics.ctr.value).toBeNull();
    expect(out.metrics.views.value).toBeNull();
    expect(out.funnel).toBeNull();
  });

  it('does not invent CTR when ingest has views but no ctr', async () => {
    const db = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/performance_ingest/i.test(sql)) {
          return {
            rows: [
              {
                payload_json: { views: 1200, channel: 'reels', source: 'ads_hub_csv' },
                created_at: '2026-09-06T00:00:00.000Z',
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    const { svc } = makeService(db);
    const out = await svc.get('performance', { scope: 'me', staffId: 1 }) as PerformanceOut;

    expect(out.metrics.views.value).toBe(1200);
    expect(out.metrics.views.source).toBe('ads_hub_csv');
    expect(out.metrics.ctr.value).toBeNull();
    expect(out.metrics.ctr.source).toEqual(expect.any(String));
  });
});

describe('CpReportsService export', () => {
  it('writes report_export activity', async () => {
    const { svc, audit } = makeService();
    const out = await svc.export(
      { slug: 'performance', format: 'csv' },
      { scope: 'me', staffId: 7 },
    );

    expect(out.ok).toBe(true);
    expect(audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 7,
        action: 'report_export',
        resource_type: 'report',
        resource_id: 'performance',
      }),
    );
  });
});

describe('CpReportsService slugs', () => {
  it('rejects an unknown slug', async () => {
    const { svc } = makeService();
    await expect(svc.get('roi', { scope: 'me', staffId: 1 })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('omits executive funnel without ingest and keeps credit forecast assumption', async () => {
    const { svc } = makeService();
    const executive = await svc.get('executive', { scope: 'me', staffId: 1 }) as ExecutiveOut;
    const credit = await svc.get('credit', { scope: 'me', staffId: 1 }) as CreditOut;

    expect(executive.funnel).toBeNull();
    expect(executive.kpis.roi).toEqual(
      expect.objectContaining({ value: null, source: expect.any(String) }),
    );
    expect(credit.forecast).toEqual(
      expect.objectContaining({
        value: null,
        assumption: expect.stringMatching(/scheduled_batch_credits/i),
      }),
    );
  });
});
