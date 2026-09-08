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
  proposalInsertParams: unknown[] = [];
  versionInsertParams: unknown[] = [];
  seq = 89;
  nextId = 1;
  txCalls = 0;

  async withTransaction<T>(
    fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>,
  ): Promise<T> {
    this.txCalls += 1;
    return fn(this.query.bind(this));
  }

  async query(sql: string, params: unknown[] = []) {
    this.sqls.push(sql);
    if (/INSERT INTO clients/i.test(sql)) {
      throw new Error('must_not_insert_clients');
    }
    if (/pg_advisory_xact_lock/i.test(sql)) {
      return { rows: [{}] };
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
    if (/FROM crm_quote_activity/i.test(sql) && /idempotency_key/i.test(sql)) {
      const key = String(params[0] ?? '');
      const act = this.activity.find((row) => {
        const snap = (row.snapshot_json ?? {}) as Record<string, unknown>;
        return snap.idempotency_key === key;
      });
      if (!act) return { rows: [] };
      const proposal = this.proposals.find((row) => Number(row.id) === Number(act.proposal_id));
      return {
        rows: [
          {
            ...act,
            quote_code: proposal?.quote_code,
            status: proposal?.status ?? 'draft',
            current_version_id: proposal?.current_version_id ?? act.version_id,
          },
        ],
      };
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
      this.proposalInsertParams = params;
      const row = {
        id: this.nextId++,
        quote_code: params.find((p) => typeof p === 'string' && String(p).startsWith('QT-PTT-')),
        status: 'draft',
        current_version_id: null,
        owner_staff_id: params[6],
      };
      this.proposals.push(row);
      return { rows: [row] };
    }
    if (/INSERT INTO crm_quote_versions/i.test(sql)) {
      this.versionInsertParams = params;
      const row = { id: `ver-${this.versions.length + 1}`, n: 1, state: 'working', created_by: params[1] };
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

  it('JWT unresolved staff (staffId 0) throws 403 qt_unresolved_staff', async () => {
    const { svc } = load();

    await expect(
      svc.create(
        {
          source: 'lead',
          lead_id: 12,
          title: 'No staff',
          quote_type: 'new_business',
        },
        { staffId: 0, staffAuthVia: 'jwt', idempotencyKey: 'jwt-unresolved' },
      ),
    ).rejects.toMatchObject({ response: { error: 'qt_unresolved_staff' } });
  });

  it('internal key still creates with staffId 0', async () => {
    const { db, svc } = load();

    const out = await svc.create(
      {
        source: 'blank',
        agency_client_id: CLIENT_ID,
        title: 'Internal blank',
        quote_type: 'campaign',
      },
      { staffId: 0, staffAuthVia: 'internal', idempotencyKey: 'internal-0' },
    );

    expect(out.proposal.status).toBe('draft');
    expect(out.proposal.id).toBeGreaterThan(0);
    expect(db.proposalInsertParams[6] == null || db.proposalInsertParams[6] === 0).toBe(true);
    expect(db.versionInsertParams[1]).toBe(0);
  });

  it('same Idempotency-Key replay returns same proposal and does not allocate a second code', async () => {
    const { db, svc } = load();
    const input = {
      source: 'lead' as const,
      lead_id: 12,
      title: 'An Phát Q3',
      quote_type: 'new_business',
    };

    const first = await svc.create(input, ACTOR);
    const seqAfterFirst = db.seq;
    const nextvalCount = db.sqls.filter((sql) => /nextval\('crm_quote_code_seq'\)/i.test(sql)).length;

    const second = await svc.create(input, ACTOR);

    expect(second.proposal.id).toBe(first.proposal.id);
    expect(second.proposal.quote_code).toBe(first.proposal.quote_code);
    expect(db.seq).toBe(seqAfterFirst);
    expect(db.sqls.filter((sql) => /nextval\('crm_quote_code_seq'\)/i.test(sql)).length).toBe(
      nextvalCount,
    );
    expect(db.proposals).toHaveLength(1);
    expect(db.sqls.some((sql) => /pg_advisory_xact_lock\(hashtext/i.test(sql))).toBe(true);
    expect(db.txCalls).toBeGreaterThan(0);
  });
});
