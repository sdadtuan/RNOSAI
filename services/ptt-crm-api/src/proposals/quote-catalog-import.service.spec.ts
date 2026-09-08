import { readFileSync } from 'fs';
import { join } from 'path';
import { SpcService } from '../spc/spc.service';
import { QuoteCatalogService } from './quote-catalog.service';

const FROZEN_SNAP = {
  dv_code: 'DV08',
  package_tier: 'standard',
  quoted_at: '2026-08-01',
  rate: { suggested_vnd: 25_000_000, rate_card_id: 'rc-old' },
};

class ImportMemory {
  sqls: string[] = [];
  txCalls = 0;
  failOnRateDv: string | null = null;
  jobs: Record<string, unknown>[] = [];
  rateCards: Record<string, unknown>[] = [];
  revisions: Record<string, unknown>[] = [];
  versions = new Map<string, Record<string, unknown>>([
    [
      'ver-pub',
      {
        id: 'ver-pub',
        proposal_id: 9,
        n: 1,
        state: 'published',
        snapshot_json: { lines: [{ catalog_snapshot_json: structuredClone(FROZEN_SNAP) }] },
      },
    ],
  ]);
  lines: Record<string, unknown>[] = [
    {
      id: 1,
      proposal_id: 9,
      dv_code: 'DV08',
      catalog_snapshot_json: structuredClone(FROZEN_SNAP),
    },
  ];

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    if (/GRANT\s/i.test(sql)) throw new Error('import_must_not_grant');
    if (/DELETE FROM crm_proposals/i.test(sql)) throw new Error('must_not_hard_delete_proposals');
    if (/UPDATE crm_quote_line_item/i.test(sql) && /catalog_snapshot_json/i.test(sql)) {
      throw new Error('must_not_rewrite_line_snapshot');
    }
    if (/UPDATE crm_quote_versions/i.test(sql) && /snapshot_json/i.test(sql)) {
      throw new Error('must_not_rewrite_version_snapshot');
    }
    if (/INSERT INTO crm_quote_import_jobs/i.test(sql)) {
      const row = {
        id: `job-${this.jobs.length + 1}`,
        filename: params[0],
        state: params[1] ?? 'queued',
        result_json: params[2] ?? {},
        created_by: params[3],
      };
      this.jobs.push(row);
      return { rows: [row] };
    }
    if (/UPDATE crm_quote_import_jobs/i.test(sql)) {
      const job = this.jobs.find((row) => String(row.id) === String(params[params.length - 1]));
      if (job) {
        if (params.length >= 3) {
          job.state = params[0];
          job.result_json = params[1];
        } else {
          job.state = params[0];
        }
      }
      return { rows: job ? [job] : [] };
    }
    if (/INSERT INTO crm_quote_rate_cards/i.test(sql)) {
      if (this.failOnRateDv && String(params[1]) === this.failOnRateDv) {
        throw new Error('mid_batch_rate_fail');
      }
      const row = {
        id: `rc-${this.rateCards.length + 1}`,
        tenant_id: params[0],
        dv_code: params[1],
        package_tier: params[2],
        fee_vnd: params[3],
        cost_labor_vnd: params[4],
        effective_from: params[5],
        effective_to: params[6],
        state: params[7],
      };
      this.rateCards.push(row);
      return { rows: [row] };
    }
    if (/INSERT INTO crm_quote_catalog_revisions/i.test(sql)) {
      const row = {
        id: `rev-${this.revisions.length + 1}`,
        catalog_service_id: params[0],
        profile_json: params[1],
      };
      this.revisions.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_versions/i.test(sql)) {
      return { rows: [...this.versions.values()] };
    }
    if (/FROM crm_quote_line_item/i.test(sql)) {
      return { rows: this.lines };
    }
    if (/FROM crm_quote_rate_cards/i.test(sql)) {
      return { rows: this.rateCards };
    }
    if (/FROM crm_catalog_services/i.test(sql) || /FROM ops_service_profile/i.test(sql)) {
      return { rows: [] };
    }
    return { rows: [] };
  }

  private snapshot() {
    return {
      jobs: this.jobs.map((row) => ({ ...row })),
      rateCards: this.rateCards.map((row) => ({ ...row })),
      revisions: this.revisions.map((row) => ({ ...row })),
    };
  }

  private restore(snap: ReturnType<ImportMemory['snapshot']>) {
    this.jobs = snap.jobs;
    this.rateCards = snap.rateCards;
    this.revisions = snap.revisions;
  }

  async withTransaction<T>(
    fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>,
  ): Promise<T> {
    this.txCalls += 1;
    const snap = this.snapshot();
    try {
      return await fn(this.query.bind(this));
    } catch (err) {
      this.restore(snap);
      throw err;
    }
  }
}

describe('QuoteCatalogService import AC-02', () => {
  it('import then old version snapshot unchanged', async () => {
    const db = new ImportMemory();
    const spc = { getQuoteCatalog: jest.fn() };
    const svc = new QuoteCatalogService(db, spc as never);
    const frozenVersion = structuredClone(db.versions.get('ver-pub')?.snapshot_json);
    const frozenLine = structuredClone(db.lines[0].catalog_snapshot_json);

    const out = await svc.importCatalog({
      filename: 'rates.json',
      json: {
        rate_cards: [
          {
            dv_code: 'DV08',
            package_tier: 'standard',
            fee_vnd: 99_000_000,
            cost_labor_vnd: 40_000_000,
            effective_from: '2026-09-09',
            state: 'active',
          },
        ],
        revisions: [{ catalog_service_id: 'DV08', profile_json: { fee_vnd: 99_000_000 } }],
      },
      created_by: 7,
    });

    expect(out.state).toBe('done');
    expect(out.result.rate_cards).toBe(1);
    expect(out.result.revisions).toBe(1);
    expect(db.jobs[0].state).toBe('done');
    expect(db.rateCards[0]).toMatchObject({ dv_code: 'DV08', fee_vnd: 99_000_000 });
    expect(db.revisions[0]).toMatchObject({ catalog_service_id: 'DV08' });
    expect(db.versions.get('ver-pub')?.snapshot_json).toEqual(frozenVersion);
    expect(db.lines[0].catalog_snapshot_json).toEqual(frozenLine);
    expect((db.lines[0].catalog_snapshot_json as { rate: { suggested_vnd: number } }).rate.suggested_vnd).toBe(
      25_000_000,
    );
    expect(db.sqls.join('\n')).not.toMatch(/UPDATE[\s\S]*catalog_snapshot_json/i);
    expect(db.sqls.join('\n')).not.toMatch(/GRANT\s/i);
    expect(db.sqls.join('\n')).not.toMatch(/DELETE FROM crm_proposals/i);
    expect(db.txCalls).toBe(1);
  });

  it('mid-batch failure rolls back committed cards and returns failed DTO', async () => {
    const db = new ImportMemory();
    db.failOnRateDv = 'DV12';
    const svc = new QuoteCatalogService(db, { getQuoteCatalog: jest.fn() } as never);

    const out = await svc.importCatalog({
      filename: 'rates.json',
      json: {
        rate_cards: [
          {
            dv_code: 'DV08',
            package_tier: 'standard',
            fee_vnd: 18_000_000,
            effective_from: '2026-09-09',
            state: 'active',
          },
          {
            dv_code: 'DV12',
            package_tier: 'standard',
            fee_vnd: 22_000_000,
            effective_from: '2026-09-09',
            state: 'active',
          },
        ],
      },
      created_by: 7,
    });

    expect(out.state).toBe('failed');
    expect(out.result.rate_cards).toBe(0);
    expect(out.result.revisions).toBe(0);
    expect(out.result.errors).toEqual(expect.arrayContaining(['mid_batch_rate_fail']));
    expect(db.rateCards).toHaveLength(0);
    expect(db.revisions).toHaveLength(0);
    expect(db.jobs[0].state).toBe('failed');
    expect(db.txCalls).toBe(1);
    expect((db.lines[0].catalog_snapshot_json as { rate: { suggested_vnd: number } }).rate.suggested_vnd).toBe(
      25_000_000,
    );
  });

  it('POST quote-catalog/import is static before :id and requires catalog manage', () => {
    const src = readFileSync(join(__dirname, 'proposals.controller.ts'), 'utf8');
    expect(src).toMatch(/@Post\('quote-catalog\/import'\)/);
    expect(src.indexOf("quote-catalog/import")).toBeLessThan(src.indexOf("@Get(':id')"));
    expect(src).toMatch(/RequireQuoteSection\('crm_quote.catalog', 'manage'\)/);
    expect(src).toMatch(/StaffQuoteGuard/);
    expect(src).toMatch(/StaffOrInternalKeyGuard/);
  });

  it('keeps SpcService as the Nest design:type so ProposalsModule can boot', () => {
    const types = Reflect.getMetadata('design:paramtypes', QuoteCatalogService) as unknown[];
    expect(types[1]).toBe(SpcService);
  });
});
