import { LeadsFunnelPgRepository } from './leads-funnel-pg.repository';

const assigned = '2026-10-12T02:00:00.000Z';

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: 88,
    full_name: 'Lead',
    phone: '',
    email: '',
    status: 'moi',
    owner_id: 3,
    meta_json: '{}',
    care_stage_current: 'first_contact',
    care_stages_done_json: '{}',
    is_duplicate: 0,
    updated_at: assigned,
    first_assigned_at: assigned,
    last_call_result: 'no_answer',
    hold_until: '2026-10-14T11:00:00.000Z',
    callback_at: null,
    last_call_at: assigned,
    attempts_since_assign: 1,
    reassign_count: 0,
    is_hot: false,
    ...overrides,
  };
}

function repo(route: (sql: string) => { rows: unknown[]; rowCount?: number }) {
  const query = jest.fn(async (sql: string) => route(sql));
  const instance = new LeadsFunnelPgRepository({ databaseUrl: 'postgres://unused' } as never);
  (instance as unknown as { pool: { query: typeof query } }).pool = { query };
  return { instance, query };
}

describe('syncReviewQueue pre-B2 hold', () => {
  it('does not pull a missed call that is still inside its hold', async () => {
    const { instance, query } = repo((sql) => {
      if (/hold_until <=/i.test(sql)) return { rows: [] };
      if (/owner_id IS NOT NULL/i.test(sql)) return { rows: [lead()] };
      return { rows: [], rowCount: 0 };
    });
    const out = await instance.syncReviewQueue('test', false, new Date('2026-10-13T02:00:00.000Z'));
    expect(out.held).toBe(1);
    expect(out.queued).toBe(0);
    const pulled = query.mock.calls.map((call) => String(call[0])).some((sql) => /owner_id = NULL/i.test(sql));
    expect(pulled).toBe(false);
  });

  it('reassigns a missed call after enough attempts', async () => {
    const row = lead({ attempts_since_assign: 5 });
    const { instance, query } = repo((sql) => {
      if (/can_receive_leads/i.test(sql)) return { rows: [{ id: 9 }] };
      if (/hold_until <=/i.test(sql)) return { rows: [row] };
      if (/owner_id IS NOT NULL/i.test(sql)) return { rows: [row] };
      return { rows: [], rowCount: 0 };
    });
    const out = await instance.syncReviewQueue('test', false, new Date('2026-10-15T02:00:00.000Z'));
    expect(out.reassigned).toBe(1);
    const update = query.mock.calls.map((call) => String(call[0])).find((sql) => /attempts_since_assign = 0/i.test(sql));
    expect(update).toBeTruthy();
  });

  it('closes a busy lead after one reassign round', async () => {
    const row = lead({
      last_call_result: 'unreachable',
      attempts_since_assign: 3,
      reassign_count: 1,
      hold_until: '2026-10-13T11:00:00.000Z',
    });
    const { instance, query } = repo((sql) => {
      if (/hold_until <=/i.test(sql)) return { rows: [row] };
      if (/owner_id IS NOT NULL/i.test(sql)) return { rows: [row] };
      return { rows: [], rowCount: 0 };
    });
    const out = await instance.syncReviewQueue('test', false, new Date('2026-10-14T02:00:00.000Z'));
    expect(out.failed).toBe(1);
    const update = query.mock.calls.map((call) => String(call[0])).find((sql) => /unreachable/i.test(sql));
    expect(update).toContain("status = 'lost'");
  });

  it('pulls an overdue callback with no new call into review', async () => {
    const row = lead({
      last_call_result: 'callback',
      callback_at: '2026-10-16T02:00:00.000Z',
      last_call_at: assigned,
      hold_until: '2026-10-16T11:00:00.000Z',
    });
    const { instance } = repo((sql) => {
      if (/l\.source/i.test(sql)) return { rows: [row] };
      if (/hold_until <=/i.test(sql)) return { rows: [row] };
      if (/owner_id IS NOT NULL/i.test(sql)) return { rows: [row] };
      return { rows: [], rowCount: 0 };
    });
    const out = await instance.syncReviewQueue('test', false, new Date('2026-10-19T02:00:00.000Z'));
    expect(out.queued).toBe(1);
    expect(out.held).toBe(0);
  });
});
