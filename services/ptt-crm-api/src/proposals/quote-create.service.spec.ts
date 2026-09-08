import { QuoteAuditRepository } from './quote-audit.repository';
import { QuoteCreateService } from './quote-create.service';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000002';
const UNKNOWN = '19d722af-0000-4000-8000-000000000099';

class CreateMemory {
  sqls: string[] = [];
  clients = new Set<string>([CLIENT_ID]);
  leads = new Map<number, Record<string, unknown>>([
    [
      12,
      {
        sqlite_lead_id: 12,
        agency_client_id: CLIENT_ID,
        converted_customer_id: 44,
        owner_id: 7,
        full_name: 'An Phát',
      },
    ],
  ]);
  proposals: Record<string, unknown>[] = [];
  versions: Record<string, unknown>[] = [];
  activity: Record<string, unknown>[] = [];
  seq = 89;
  nextId = 1;

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    if (/INSERT INTO clients/i.test(sql)) {
      throw new Error('must_not_insert_clients');
    }
    if (/INSERT INTO crm_quote_activity/i.test(sql)) {
      const row = {
        id: `act-${this.activity.length + 1}`,
        proposal_id: params[1],
        version_id: params[2],
        actor_staff_id: params[3],
        actor_kind: params[4],
        action: params[5],
        resource: params[6],
        snapshot_json: params[7] ?? {},
        created_at: new Date().toISOString(),
      };
      this.activity.push(row);
      return { rows: [row] };
    }
    if (/FROM crm_quote_activity/i.test(sql)) {
      return { rows: this.activity };
    }
    if (/nextval\('crm_quote_code_seq'\)/i.test(sql)) {
      const seq = this.seq++;
      return { rows: [{ seq, nextval: seq }] };
    }
    if (/FROM clients/i.test(sql)) {
      const id = String(params[0] ?? '');
      return { rows: this.clients.has(id) ? [{ id }] : [] };
    }
    if (/FROM crm_leads/i.test(sql)) {
      const lead = this.leads.get(Number(params[0]));
      return { rows: lead ? [lead] : [] };
    }
    if (/INSERT INTO crm_proposals/i.test(sql)) {
      const row = {
        id: this.nextId++,
        quote_code: params.find((p) => typeof p === 'string' && String(p).startsWith('QT-PTT-')),
        status: 'draft',
        current_version_id: null,
      };
      this.proposals.push(row);
      return { rows: [row] };
    }
    if (/INSERT INTO crm_quote_versions/i.test(sql)) {
      const row = { id: `ver-${this.versions.length + 1}`, n: 1, state: 'working' };
      this.versions.push(row);
      return { rows: [row] };
    }
    if (/UPDATE crm_proposals/i.test(sql)) {
      const last = this.proposals[this.proposals.length - 1];
      if (last) last.current_version_id = this.versions[this.versions.length - 1]?.id ?? null;
      return { rows: last ? [last] : [] };
    }
    if (/FROM crm_proposals/i.test(sql)) {
      return { rows: this.proposals };
    }
    return { rows: [] };
  }
}

function load(db = new CreateMemory()) {
  const audit = new QuoteAuditRepository(db);
  return { db, audit, svc: new QuoteCreateService(db, audit) };
}

const ACTOR = { staffId: 7, idempotencyKey: 'ac-01-key' };

describe('QuoteCreateService', () => {
  it('AC-01 create from lead yields draft quote_code, working v1, and quote.created', async () => {
    const { db, audit, svc } = load();

    const out = await svc.create(
      {
        source: 'lead',
        lead_id: 12,
        title: 'An Phát Q3',
        quote_type: 'new_business',
      },
      ACTOR,
    );

    expect(out.proposal).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        quote_code: 'QT-PTT-2026-000089',
        status: 'draft',
        current_version_id: expect.any(String),
      }),
    );
    expect(db.sqls.some((sql) => /nextval\('crm_quote_code_seq'\)/i.test(sql))).toBe(true);
    expect(db.sqls.some((sql) => /INSERT INTO crm_quote_versions/i.test(sql))).toBe(true);
    expect(db.versions[0]).toMatchObject({ n: 1, state: 'working' });
    const logged = await audit.list({ proposal_id: out.proposal.id });
    expect(logged.some((row) => row.action === 'quote.created')).toBe(true);
  });

  it('unknown client UUID returns 400 client_not_found', async () => {
    const { svc } = load();

    await expect(
      svc.create(
        {
          source: 'am360',
          agency_client_id: UNKNOWN,
          title: 'Ghost',
          quote_type: 'retainer',
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({ response: { error: 'client_not_found' } });
  });

  it('create does not INSERT into clients', async () => {
    const { db, svc } = load();

    await svc.create(
      {
        source: 'blank',
        agency_client_id: CLIENT_ID,
        title: 'Blank quote',
        quote_type: 'campaign',
      },
      ACTOR,
    );

    expect(db.sqls.some((sql) => /INSERT INTO clients/i.test(sql))).toBe(false);
  });

  it('requires Idempotency-Key on the new path', async () => {
    const { svc } = load();

    await expect(
      svc.create(
        {
          source: 'lead',
          lead_id: 12,
          title: 'No key',
          quote_type: 'new_business',
        },
        { staffId: 7, idempotencyKey: '' },
      ),
    ).rejects.toMatchObject({ response: { error: 'idempotency_key_required' } });
  });
});
