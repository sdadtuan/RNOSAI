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
  closed_loop?: unknown[];
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
    expect(out.closed_loop).toEqual([]);
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

describe('CpReportsService ingest scope', () => {
  it('binds performance ingest to scoped_projects so scope=me cannot see tenant-wide views', async () => {
    const db = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/performance_ingest/i.test(sql)) {
          return {
            rows: [
              {
                payload_json: { views: 9999, ctr: 0.4, roi: 12, source: 'ads_hub_csv' },
                created_at: '2026-09-06T00:00:00.000Z',
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    const { svc } = makeService(db);
    await svc.get('performance', { scope: 'me', staffId: 11 });

    const sql = sqlCalls(db);
    expect(sql).toMatch(/performance_ingest/);
    expect(sql).toMatch(/scoped_projects/);
    expect(sql).toMatch(/owner_staff_id/);
    expect(firstParams(db, /performance_ingest/)).toEqual(expect.arrayContaining([11]));
  });
});

describe('CpReportsService export', () => {
  it('serializes computed KPI/metric rows and leaves missing CTR empty', async () => {
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
    const out = await svc.export(
      { slug: 'performance', format: 'csv' },
      { scope: 'me', staffId: 7 },
    );

    expect(out.body).toMatch(/views/i);
    expect(out.body).toMatch(/1200/);
    expect(out.body).toMatch(/ctr/i);
    expect(out.body).not.toMatch(/^slug,format$/m);
    expect(out.body).not.toMatch(/ctr,[0-9]/i);
  });

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

function sqlCalls(db: { query: jest.Mock }): string {
  return db.query.mock.calls.map((call) => String(call[0])).join('\n');
}

function firstParams(db: { query: jest.Mock }, needle: RegExp): unknown[] {
  const hit = db.query.mock.calls.find((call) => needle.test(String(call[0])));
  return (hit?.[1] as unknown[]) ?? [];
}

describe('CpReportsService period filters', () => {
  it('applies from/to to executive version and project queries', async () => {
    const db = emptyDb();
    const { svc } = makeService(db);
    await svc.get('executive', {
      scope: 'me',
      staffId: 1,
      from: '2026-09-01',
      to: '2026-09-07',
      client: 'client-1',
    });

    const sql = sqlCalls(db);
    expect(sql).toMatch(/d\.created_at[\s\S]*\$1::date|\$1::date[\s\S]*d\.created_at/);
    expect(sql).toMatch(/p\.created_at[\s\S]*\$1::date|\$1::date[\s\S]*p\.created_at/);
    expect(sql).toMatch(/crm_cp_video_versions/);
    expect(sql).toMatch(/status = 'at_risk'/);
    expect(firstParams(db, /output_final|at_risk/)).toEqual(
      expect.arrayContaining(['2026-09-01', '2026-09-07', 'client-1']),
    );
  });

  it('queries executive trend, top creative, and project health', async () => {
    const db = emptyDb();
    const { svc } = makeService(db);
    const out = await svc.get('executive', { scope: 'me', staffId: 1 }) as {
      trend: unknown;
      top_creative: unknown;
      project_health: unknown;
    };

    const sql = sqlCalls(db);
    expect(out.trend).toEqual(expect.any(Array));
    expect(out.top_creative).toEqual(expect.any(Array));
    expect(out.project_health).toEqual(expect.any(Array));
    expect(sql).toMatch(/GROUP BY[\s\S]*day|::date::text AS day/i);
    expect(sql).toMatch(/ORDER BY[\s\S]*LIMIT/i);
    expect(sql).toMatch(/p\.status|project_health|credit_budget/i);
  });

  it('applies from/to/client on production, credit, governance, and ingest', async () => {
    const slugs = ['production', 'credit', 'governance', 'performance'] as const;
    for (const slug of slugs) {
      const db = emptyDb();
      const { svc } = makeService(db);
      await svc.get(slug, {
        scope: 'me',
        staffId: 1,
        from: '2026-09-01',
        to: '2026-09-07',
        client: 'client-9',
      });
      const sql = sqlCalls(db);
      expect(sql).toMatch(/\$1::date/);
      expect(sql).toMatch(/\$2::date/);
      if (slug === 'performance') {
        expect(sql).toMatch(/performance_ingest/);
        expect(sql).toMatch(/agency_client_id|payload_json->>'client'/);
      } else {
        expect(sql).toMatch(/agency_client_id/);
      }
      expect(firstParams(db, /\$1::date/)).toEqual(
        expect.arrayContaining(['2026-09-01', '2026-09-07', 'client-9']),
      );
    }
  });
});

describe('CpReportsService production queue and providers', () => {
  it('measures queue p95 as created-to-start over completed jobs', async () => {
    const db = emptyDb();
    const { svc } = makeService(db);
    await svc.get('production', { scope: 'me', staffId: 1, from: '2026-08-01', to: '2026-08-31' });

    const sql = sqlCalls(db);
    expect(sql).toMatch(/queue_p95|queue_wait/);
    expect(sql).toMatch(/state = 'completed'/);
    expect(sql).not.toMatch(/state IN \('queued','preparing'\)[\s\S]*queue_p95/);
    expect(sql).not.toMatch(/queue_p95[\s\S]*state IN \('queued','preparing'\)/);
    expect(sql).toMatch(/created_at/);
    expect(sql).toMatch(/->>'at'|queue_wait_sec/);
  });

  it('queries heatmap and provider health from job model/provider', async () => {
    const db = emptyDb();
    const { svc } = makeService(db);
    const out = await svc.get('production', { scope: 'me', staffId: 1 }) as {
      heatmap: unknown;
      provider_health: unknown;
    };

    const sql = sqlCalls(db);
    expect(out.heatmap).toEqual(expect.any(Array));
    expect(out.provider_health).toEqual(expect.any(Array));
    expect(sql).toMatch(/heatmap|::date::text AS day/i);
    expect(sql).toMatch(/j\.provider|j\.model/);
    expect(sql).toMatch(/success_pct|GROUP BY/);
  });
});

describe('CpReportsService credit pipeline', () => {
  it('returns by_pipeline from the ledger query', async () => {
    const db = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/cost_center|pipeline/i.test(sql) && /GROUP BY/i.test(sql)) {
          return { rows: [{ pipeline: 'gen', kind: 'charge', amount: 12 }] };
        }
        return { rows: [] };
      }),
    };
    const { svc } = makeService(db);
    const out = await svc.get('credit', { scope: 'me', staffId: 1 }) as {
      by_pipeline: Array<{ pipeline: string }>;
    };

    expect(out.by_pipeline).toEqual([
      expect.objectContaining({ pipeline: 'gen' }),
    ]);
  });
});
