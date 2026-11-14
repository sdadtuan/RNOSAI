import {
  HandoffSlaAlertService,
  HANDOFF_SLA_EXCLUDED_LEAD_STATUSES,
  isAlertableClock,
  isHandoffSlaAlertWorkerEnabled,
  resolveHandoffSlaAlertSince,
} from './handoff-sla-alert.service';

describe('handoff SLA alert config', () => {
  it('worker is off unless explicitly enabled', () => {
    expect(isHandoffSlaAlertWorkerEnabled({})).toBe(false);
    expect(isHandoffSlaAlertWorkerEnabled({ PTT_HANDOFF_SLA_ALERT_WORKER: '0' })).toBe(false);
    expect(isHandoffSlaAlertWorkerEnabled({ PTT_HANDOFF_SLA_ALERT_WORKER: '1' })).toBe(true);
    expect(isHandoffSlaAlertWorkerEnabled({ PTT_HANDOFF_SLA_ALERT_WORKER: 'true' })).toBe(true);
  });

  it('go-live cutoff comes from env, else the fallback (process start)', () => {
    const fallback = new Date('2026-11-14T10:00:00.000Z');
    expect(resolveHandoffSlaAlertSince({}, fallback).toISOString()).toBe(fallback.toISOString());
    expect(resolveHandoffSlaAlertSince({ PTT_HANDOFF_SLA_ALERT_SINCE: 'bad' }, fallback).toISOString()).toBe(
      fallback.toISOString(),
    );
    expect(
      resolveHandoffSlaAlertSince({ PTT_HANDOFF_SLA_ALERT_SINCE: '2026-11-20T01:30:00Z' }, fallback).toISOString(),
    ).toBe('2026-11-20T01:30:00.000Z');
  });

  it('only warning/breach clocks due at/after the cutoff alert', () => {
    const since = new Date('2026-11-14T10:00:00.000Z');
    expect(isAlertableClock({ state: 'breach', due_at: '2026-11-14T09:59:00.000Z' }, since)).toBe(false);
    expect(isAlertableClock({ state: 'breach', due_at: '2026-11-14T10:00:00.000Z' }, since)).toBe(true);
    expect(isAlertableClock({ state: 'warning', due_at: '2026-11-15T10:00:00.000Z' }, since)).toBe(true);
    expect(isAlertableClock({ state: 'ok', due_at: '2026-11-15T10:00:00.000Z' }, since)).toBe(false);
    expect(isAlertableClock({ state: 'breach', due_at: null }, since)).toBe(false);
  });

  it('skips closed lead statuses', () => {
    for (const s of ['won', 'converted', 'closed', 'pending_cleanup', 'lost']) {
      expect(HANDOFF_SLA_EXCLUDED_LEAD_STATUSES as readonly string[]).toContain(s);
    }
  });
});

describe('HandoffSlaAlertService.tick', () => {
  const now = new Date('2026-11-16T05:00:00.000Z'); // Mon 12:00 ICT
  const prevSince = process.env.PTT_HANDOFF_SLA_ALERT_SINCE;
  beforeAll(() => {
    process.env.PTT_HANDOFF_SLA_ALERT_SINCE = '2026-11-16T00:00:00.000Z';
  });
  afterAll(() => {
    if (prevSince === undefined) delete process.env.PTT_HANDOFF_SLA_ALERT_SINCE;
    else process.env.PTT_HANDOFF_SLA_ALERT_SINCE = prevSince;
  });

  function row(over: Record<string, unknown> = {}) {
    return {
      presales_id: 1,
      lead_id: 121,
      status: 'bao_gia',
      owner_id: 42,
      handoff_status: 'released',
      solution_released_at: '2026-11-13T09:00:00.000Z',
      solution_customer_due_at: '2026-11-16T03:00:00.000Z', // after cutoff, before now -> breach
      ...over,
    };
  }

  function setup(rows: Array<Record<string, unknown>>, notifyResult: string | null) {
    const calls: string[] = [];
    let page = 0;
    const query = jest.fn(async (sql: string) => {
      calls.push(sql);
      if (sql.includes('FROM crm_lead_presales ps')) {
        page += 1;
        return { rows: page === 1 ? rows : [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO crm_handoff_sla_alerts')) return { rows: [{ id: 11 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const notifications = { notifyStaff: jest.fn().mockResolvedValue(notifyResult) };
    const svc = new HandoffSlaAlertService({ databaseUrl: 'postgres://unused' } as never, notifications as never);
    (svc as unknown as { pool: unknown }).pool = { query };
    return { svc, calls, notifications };
  }

  it('marks sent only after delivery and runs DDL once', async () => {
    const { svc, calls, notifications } = setup([row()], 'user-42');
    const out = await svc.tick(now);
    expect(out.sent).toBe(1);
    expect(notifications.notifyStaff).toHaveBeenCalledWith(42, expect.objectContaining({ kind: 'handoff_sla_breach' }));
    expect(calls.some((s) => s.includes('UPDATE crm_handoff_sla_alerts SET sent_at'))).toBe(true);
    await svc.tick(now);
    expect(calls.filter((s) => s.includes('CREATE TABLE IF NOT EXISTS crm_handoff_sla_alerts')).length).toBe(1);
    expect(calls.filter((s) => s.includes('ALTER TABLE crm_lead_presales')).length).toBe(1);
  });

  it('releases the claim when delivery fails so the next tick retries', async () => {
    const { svc, calls } = setup([row()], null);
    const out = await svc.tick(now);
    expect(out.sent).toBe(0);
    expect(out.failed).toBe(1);
    expect(calls.some((s) => s.includes('DELETE FROM crm_handoff_sla_alerts'))).toBe(true);
  });

  it('does not record or count clocks without recipients', async () => {
    const { svc, calls } = setup([row({ owner_id: null })], 'user-x');
    const out = await svc.tick(now);
    expect(out.sent).toBe(0);
    expect(out.skipped_no_recipient).toBe(1);
    expect(calls.some((s) => s.includes('INSERT INTO crm_handoff_sla_alerts'))).toBe(false);
  });

  it('ignores clocks that were already due before the go-live cutoff', async () => {
    const { svc, notifications } = setup([row({ solution_customer_due_at: '2026-11-15T03:00:00.000Z' })], 'user-42');
    const out = await svc.tick(now);
    expect(out.sent).toBe(0);
    expect(notifications.notifyStaff).not.toHaveBeenCalled();
  });

  it('dedupes on due_at and paginates with bounded keyset batches', async () => {
    const { svc, calls } = setup([row()], 'user-42');
    await svc.tick(now);
    const insert = calls.find((s) => s.includes('INSERT INTO crm_handoff_sla_alerts')) ?? '';
    expect(insert).toContain('ON CONFLICT (lead_id, clock_key, state, due_at)');
    const scan = calls.find((s) => s.includes('FROM crm_lead_presales ps')) ?? '';
    expect(scan).toContain('ps.id > $1');
    expect(scan).toContain('ORDER BY ps.id ASC');
  });
});
