import { QuoteListService } from './quote-list.service';

class ListMemory {
  lastSql = '';
  lastParams: unknown[] = [];
  rows: Record<string, unknown>[] = [];
  count = 0;

  async query(sql: string, params: unknown[] = []) {
    this.lastSql = sql;
    this.lastParams = params;
    if (/COUNT/i.test(sql) && /FROM crm_proposals/i.test(sql)) {
      return { rows: [{ n: this.count || this.rows.length }] };
    }
    if (/FROM crm_proposals/i.test(sql)) {
      let rows = this.rows;
      if (/p\.owner_staff_id = \$/i.test(sql) && !/OR EXISTS/i.test(sql) && sql !== 'TRUE') {
        const staff = this.lastParams.find((p) => typeof p === 'number' && p > 0);
        if (staff != null) {
          rows = rows.filter(
            (row) =>
              Number(row.owner_staff_id) === Number(staff) ||
              (Array.isArray(row.co_owner_staff_ids) &&
                row.co_owner_staff_ids.includes(Number(staff))),
          );
        }
      }
      return { rows };
    }
    return { rows: [] };
  }
}

function load(db = new ListMemory()) {
  return { db, svc: new QuoteListService(db) };
}

const ME = {
  scope: 'me' as const,
  staffId: 7,
  teamIds: [] as number[],
  hasFinance: false,
};

describe('QuoteListService', () => {
  it('AC-12 scope me hides other owner', async () => {
    const { db, svc } = load();
    db.rows = [
      {
        id: 1,
        quote_code: 'QT-PTT-2026-000001',
        n: 1,
        client_name: 'Mine',
        lead_id: 10,
        owner_staff_id: 7,
        owner_name: 'AM Minh',
        status: 'draft',
        payable_vnd: 100,
        fee_vnd: 80,
        gm_bps: 3000,
        valid_until: '2026-09-20',
      },
      {
        id: 2,
        quote_code: 'QT-PTT-2026-000002',
        n: 1,
        client_name: 'Other',
        lead_id: 11,
        owner_staff_id: 99,
        owner_name: 'AM Other',
        status: 'draft',
        payable_vnd: 200,
        fee_vnd: 160,
        gm_bps: 2800,
        valid_until: '2026-09-21',
      },
    ];

    const out = await svc.list(ME);

    expect(db.lastSql).toMatch(/owner_staff_id/);
    expect(out.items.map((row) => row.quote_code)).toEqual(['QT-PTT-2026-000001']);
    expect(out.items.some((row) => row.quote_code === 'QT-PTT-2026-000002')).toBe(false);
  });

  it('never returns cost fields or gm_bps without finance', async () => {
    const { db, svc } = load();
    db.rows = [
      {
        id: 3,
        quote_code: 'QT-PTT-2026-000003',
        n: 2,
        client_name: 'Bloom',
        lead_id: 51,
        owner_staff_id: 7,
        owner_name: 'AM Minh',
        status: 'sent',
        payable_vnd: 84240000,
        fee_vnd: 70000000,
        gm_bps: 3120,
        direct_cost_vnd: 50000000,
        nsr_vnd: 72000000,
        cost_labor_vnd: 20000000,
        valid_until: '2026-09-30',
      },
    ];

    const out = await svc.list({ ...ME, hasFinance: false });

    expect(out.items[0].gm_bps).toBeNull();
    expect(out.items[0].option).toBeNull();
    expect(out.items[0]).toEqual(
      expect.objectContaining({
        quote_code: 'QT-PTT-2026-000003',
        version_n: 2,
        client_name: 'Bloom',
        payable_vnd: 84240000,
        fee_vnd: 70000000,
        status: 'sent',
      }),
    );
    expect(JSON.stringify(out)).not.toMatch(/cost_|nsr|direct_cost/i);
  });

  it('applies q, status, expiring, pending_my_approval, page, and page_size', async () => {
    const { db, svc } = load();

    await svc.list({
      ...ME,
      status: 'pending_approval',
      q: 'An Phát',
      expiring: true,
      pending_my_approval: true,
      page: 2,
      page_size: 25,
    });

    expect(db.lastSql).toMatch(/pending_approval|p\.status/i);
    expect(db.lastSql).toMatch(/valid_until/i);
    expect(db.lastSql.toLowerCase()).toMatch(/limit/);
    expect(db.lastParams).toEqual(expect.arrayContaining(['An Phát', 25, 25]));
  });

  it('q=LD-12 matches displayed lead code LD-{lead_id}', async () => {
    const { db, svc } = load();

    await svc.list({ ...ME, q: 'LD-12' });

    expect(db.lastSql).toMatch(/'LD-'\s*\|\|\s*p\.lead_id/);
    expect(db.lastParams).toEqual(expect.arrayContaining(['LD-12']));
  });
});
