import { QuoteVersionsRepository, type QuoteVersionDiff } from './quote-versions.repository';

class VersionMemory {
  sqls: string[] = [];
  proposals = new Map<number, Record<string, unknown>>();
  versions = new Map<string, Record<string, unknown>>();
  lines: Record<string, unknown>[] = [];
  payments: Record<string, unknown>[] = [];
  kpis: Record<string, unknown>[] = [];
  clauses: Record<string, unknown>[] = [];
  catalog = new Map<string, Record<string, unknown>>();
  settings: Record<string, unknown> = {
    tenant_id: 'PTT',
    vat_bps: 800,
    payment_template: '50/30/20',
  };
  nextLineId = 1;

  async withTransaction<T>(
    fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>,
  ): Promise<T> {
    return fn(this.query.bind(this));
  }

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    if (/DELETE FROM crm_proposals/i.test(sql)) {
      throw new Error('must_not_hard_delete_proposals');
    }
    if (/FROM crm_quote_settings/i.test(sql)) {
      return { rows: [this.settings] };
    }
    if (/FROM crm_catalog_services/i.test(sql) || /FROM ops_service_profile/i.test(sql)) {
      const key = String(params[0] ?? '').toUpperCase();
      const row = this.catalog.get(key);
      return { rows: row ? [row] : [] };
    }
    if (/FROM crm_proposals/i.test(sql) && /WHERE id/i.test(sql)) {
      const row = this.proposals.get(Number(params[0]));
      return { rows: row ? [row] : [] };
    }
    if (/UPDATE crm_proposals/i.test(sql) && /SET\s+current_version_id/i.test(sql)) {
      const id = Number(params[params.length - 1]);
      const row = this.proposals.get(id);
      if (!row) return { rows: [] };
      if (/current_version_id IS NULL/i.test(sql) && row.current_version_id) return { rows: [] };
      row.current_version_id = params[0];
      return { rows: [row] };
    }
    if (/UPDATE crm_proposals/i.test(sql) && /row_version/i.test(sql)) {
      const id = Number(params[params.length - 1] ?? params[0]);
      const expected = Number(params[params.length - 2] ?? 0);
      const row = this.proposals.get(id);
      if (!row || Number(row.row_version) !== expected) return { rows: [], rowCount: 0 };
      row.row_version = Number(row.row_version) + 1;
      row.title = params[0];
      row.objective = params[1];
      row.audience = params[2];
      row.campaign_period = params[3];
      row.updated_at = new Date().toISOString();
      return { rows: [row], rowCount: 1 };
    }
    if (/FROM crm_quote_kpis/i.test(sql)) {
      const vid = String(params[0] ?? '');
      return { rows: this.kpis.filter((k) => String(k.version_id) === vid) };
    }
    if (/INSERT INTO crm_quote_kpis/i.test(sql)) {
      const row = {
        id: `kpi-${this.kpis.length + 1}`,
        version_id: params[0],
        option_key: params[1],
        name: params[2],
        class: params[3],
        value_text: params[4],
        source: params[5],
        assumption: params[6],
      };
      this.kpis.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_clauses/i.test(sql)) {
      const vid = String(params[0] ?? '');
      return { rows: this.clauses.filter((c) => String(c.version_id) === vid) };
    }
    if (/INSERT INTO crm_quote_clauses/i.test(sql)) {
      const row = {
        id: `cl-${this.clauses.length + 1}`,
        version_id: params[0],
        template_key: params[1],
        body: params[2],
        diverged: params[3],
      };
      this.clauses.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_versions/i.test(sql)) {
      if (/AND n =/i.test(sql)) {
        const row = [...this.versions.values()].find(
          (v) => Number(v.proposal_id) === Number(params[0]) && Number(v.n) === Number(params[1]),
        );
        return { rows: row ? [row] : [] };
      }
      if (/proposal_id = \$1/i.test(sql) && !/id::text/i.test(sql)) {
        return {
          rows: [...this.versions.values()]
            .filter((v) => Number(v.proposal_id) === Number(params[0]))
            .sort((a, b) => Number(a.n) - Number(b.n)),
        };
      }
      const vid = String(params[0] ?? '');
      const row = this.versions.get(vid);
      return { rows: row ? [row] : [] };
    }
    if (/UPDATE crm_quote_versions/i.test(sql)) {
      const vid = String(params[params.length - 1] ?? '');
      const row = this.versions.get(vid);
      if (!row) return { rows: [] };
      if (params.length <= 2) {
        row.snapshot_json = params[0];
        return { rows: [row] };
      }
      row.fee_vnd = params[0];
      row.media_vnd = params[1];
      row.discount_vnd = params[2];
      row.tax_vnd = params[3];
      row.payable_vnd = params[4];
      row.nsr_vnd = params[5];
      row.direct_cost_vnd = params[6];
      row.gm_bps = params[7];
      row.snapshot_json = params[8];
      return { rows: [row] };
    }
    if (/DELETE FROM crm_quote_payment_schedules/i.test(sql)) {
      const vid = String(params[0] ?? '');
      this.payments = this.payments.filter((p) => String(p.version_id) !== vid);
      return { rows: [] };
    }
    if (/INSERT INTO crm_quote_payment_schedules/i.test(sql)) {
      const row = {
        id: `pay-${this.payments.length + 1}`,
        version_id: params[0],
        seq: params[1],
        pct_bps: params[2],
        amount_vnd: params[3],
        milestone: params[4],
      };
      this.payments.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_payment_schedules/i.test(sql)) {
      const vid = String(params[0] ?? '');
      return { rows: this.payments.filter((p) => String(p.version_id) === vid) };
    }
    if (/DELETE FROM crm_quote_line_item/i.test(sql)) {
      const pid = Number(params[0]);
      this.lines = this.lines.filter((l) => Number(l.proposal_id) !== pid);
      return { rows: [] };
    }
    if (/INSERT INTO crm_quote_line_item/i.test(sql)) {
      const row = {
        id: this.nextLineId++,
        proposal_id: params[0],
        dv_code: params[1],
        sku_code: params[2],
        package_tier: params[3],
        service_slug: params[4],
        reference_price_min: params[5],
        reference_price_max: params[6],
        final_price_vnd: params[7],
        scope_notes: params[8],
        sort_order: params[9],
        item_type: params[10],
        qty: params[11],
        unit_price_vnd: params[12],
        discount_vnd: params[13],
        media_amount_vnd: params[14],
        tax_vnd: params[15],
        cost_labor_vnd: params[16],
        cost_outsource_vnd: params[17],
        cost_other_vnd: params[18],
        client_visible: params[19],
        catalog_snapshot_json: params[20],
      };
      this.lines.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_line_item/i.test(sql)) {
      const pid = Number(params[0]);
      return { rows: this.lines.filter((l) => Number(l.proposal_id) === pid) };
    }
    if (/INSERT INTO crm_quote_versions/i.test(sql)) {
      const copied = params.length >= 4;
      const row = {
        id: `ver-${this.versions.size + 1}`,
        proposal_id: params[0],
        n: copied ? params[1] : 1,
        state: 'working',
        snapshot_json: copied ? JSON.parse(JSON.stringify(params[2] ?? {})) : {},
        created_by: copied ? params[3] : params[1],
        fee_vnd: copied ? params[4] : 0,
        media_vnd: copied ? params[5] : 0,
        discount_vnd: copied ? params[6] : 0,
        tax_vnd: copied ? params[7] : 0,
        payable_vnd: copied ? params[8] : 0,
        nsr_vnd: copied ? params[9] : null,
        direct_cost_vnd: copied ? params[10] : null,
        gm_bps: copied ? params[11] : null,
      };
      this.versions.set(String(row.id), row);
      return { rows: [row] };
    }
    return { rows: [] };
  }
}

describe('QuoteVersionsRepository', () => {
  it('stale If-Match does not bump row_version', async () => {
    const db = new VersionMemory();
    db.proposals.set(9, {
      id: 9,
      quote_code: 'QT-PTT-2026-000001',
      current_version_id: 'ver-1',
      row_version: 2,
      title: 'Old',
    });
    const repo = new QuoteVersionsRepository(db);

    const updated = await repo.updateHeader(
      9,
      { title: 'New', objective: 'o', audience: 'a', campaign_period: 'Q3' },
      1,
    );

    expect(updated).toBeNull();
    expect(db.proposals.get(9)?.row_version).toBe(2);
    expect(db.proposals.get(9)?.title).toBe('Old');
  });

  it('matching row_version bumps and writes header fields', async () => {
    const db = new VersionMemory();
    db.proposals.set(9, {
      id: 9,
      quote_code: 'QT-PTT-2026-000001',
      current_version_id: 'ver-1',
      row_version: 2,
      title: 'Old',
    });
    const repo = new QuoteVersionsRepository(db);

    const updated = await repo.updateHeader(
      9,
      { title: 'An Phát Q3', objective: 'Win', audience: 'CFO', campaign_period: '2026-Q3' },
      2,
    );

    expect(updated?.row_version).toBe(3);
    expect(updated?.title).toBe('An Phát Q3');
  });

  it('replaceLines persists item_type, media, tax, and catalog snapshot', async () => {
    const db = new VersionMemory();
    const repo = new QuoteVersionsRepository(db);
    const snapshot = { dv_code: 'DV02', package_tier: 'standard', rate: { suggested_vnd: 25000000 } };

    const lines = await repo.replaceLines(9, [
      {
        dv_code: 'DV02',
        sku_code: 'DV02-TC',
        package_tier: 'standard',
        service_slug: 'content',
        reference_price_min: 20000000,
        reference_price_max: 30000000,
        final_price_vnd: 25000000,
        scope_notes: '',
        item_type: 'fee',
        qty: 1,
        unit_price_vnd: 25000000,
        discount_vnd: 0,
        media_amount_vnd: 0,
        tax_vnd: 0,
        cost_labor_vnd: null,
        cost_outsource_vnd: null,
        cost_other_vnd: null,
        client_visible: true,
        catalog_snapshot_json: snapshot,
      },
    ]);

    expect(lines[0]).toMatchObject({
      item_type: 'fee',
      catalog_snapshot_json: snapshot,
      package_tier: 'standard',
    });
    expect(db.sqls.some((sql) => /catalog_snapshot_json/i.test(sql))).toBe(true);
    expect(db.sqls.some((sql) => /item_type/i.test(sql))).toBe(true);
  });

  it('createNextWorkingVersion copies snapshot into v_n+1 and leaves v1 immutable', async () => {
    const db = new VersionMemory();
    db.proposals.set(9, {
      id: 9,
      quote_code: 'QT-PTT-2026-000001',
      current_version_id: 'ver-1',
      row_version: 1,
      status: 'sent',
    });
    const snap = { lines: [{ qty: 1, unit_price_vnd: 25000000 }], money: { fee_vnd: 25000000 } };
    db.versions.set('ver-1', {
      id: 'ver-1',
      proposal_id: 9,
      n: 1,
      state: 'published',
      snapshot_json: snap,
      fee_vnd: 25000000,
      created_by: 7,
    });
    db.payments.push({
      id: 'pay-1',
      version_id: 'ver-1',
      seq: 1,
      pct_bps: 10000,
      amount_vnd: 25000000,
      milestone: 'Full',
    });
    const repo = new QuoteVersionsRepository(db);

    const v2 = await repo.createNextWorkingVersion(9, 7);

    expect(v2.n).toBe(2);
    expect(v2.state).toBe('working');
    expect(v2.snapshot_json).toEqual(snap);
    expect(db.versions.get('ver-1')?.snapshot_json).toEqual(snap);
    expect(db.versions.get('ver-1')?.state).toBe('published');
    expect(db.proposals.get(9)?.current_version_id).toBe(v2.id);
    const copied = await repo.listPayments(v2.id);
    expect(copied).toHaveLength(1);
    expect(copied[0].pct_bps).toBe(10000);
  });

  it('compareVersions persists v_n → v_n+1 commercial diff', async () => {
    const db = new VersionMemory();
    db.proposals.set(9, { id: 9, current_version_id: 'ver-2', status: 'sent' });
    db.versions.set('ver-1', {
      id: 'ver-1',
      proposal_id: 9,
      n: 1,
      state: 'published',
      snapshot_json: {
        lines: [{ qty: 1, unit_price_vnd: 25000000, scope_notes: 'A' }],
        payments: [{ seq: 1, pct_bps: 10000, amount_vnd: 25000000, milestone: 'Full' }],
      },
    });
    db.versions.set('ver-2', {
      id: 'ver-2',
      proposal_id: 9,
      n: 2,
      state: 'working',
      snapshot_json: {
        lines: [{ qty: 2, unit_price_vnd: 30000000, scope_notes: 'B' }],
        payments: [{ seq: 1, pct_bps: 5000, amount_vnd: 15000000, milestone: 'Cọc' }],
      },
    });
    const repo = new QuoteVersionsRepository(db);

    const items = await repo.compareVersions(9, 1, 2);

    expect(
      items.some((d: QuoteVersionDiff) => d.path === 'lines[0].qty' && d.from === 1 && d.to === 2 && d.critical),
    ).toBe(true);
    expect(items.some((d: QuoteVersionDiff) => d.path.includes('unit_price') && d.critical)).toBe(true);
    expect(db.versions.get('ver-2')?.snapshot_json).toMatchObject({
      compare: { from_n: 1, to_n: 2 },
    });
    expect(db.versions.get('ver-1')?.snapshot_json).not.toHaveProperty('compare');
  });

  it('replacePayments writes 50/30/20 remainder amounts and never hard-deletes quotes', async () => {
    const db = new VersionMemory();
    const repo = new QuoteVersionsRepository(db);

    await repo.replacePayments('ver-1', [
      { seq: 1, pct_bps: 5000, amount_vnd: 132823800n, milestone: 'Đợt 1' },
      { seq: 2, pct_bps: 3000, amount_vnd: 79694280n, milestone: 'Đợt 2' },
      { seq: 3, pct_bps: 2000, amount_vnd: 53129520n, milestone: 'Đợt 3' },
    ]);

    const rows = await repo.listPayments('ver-1');
    expect(rows.map((r) => Number(r.amount_vnd))).toEqual([132823800, 79694280, 53129520]);
    expect(rows.reduce((s, r) => s + Number(r.pct_bps), 0)).toBe(10000);
    expect(db.sqls.some((sql) => /DELETE FROM crm_proposals/i.test(sql))).toBe(false);
  });
});
