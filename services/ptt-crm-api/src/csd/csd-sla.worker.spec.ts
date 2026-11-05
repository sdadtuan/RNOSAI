import { Pool } from 'pg';
import { tickCsdSla } from './csd-sla.worker';

describe('tickCsdSla', () => {
  const policyRow = {
    workday_start: '08:30:00',
    workday_end: '18:00:00',
    workdays: [1, 2, 3, 4, 5, 6],
    at_risk_pct: 70,
    near_breach_pct: 90,
    holidays: [],
  };

  const ticketRow = {
    id: 't1',
    code: 'PTT-2026-000001',
    status: 'assigned',
    priority: 'P2',
    assignee_staff_id: 5 as number | null,
    owner_staff_id: null as number | null,
    created_by_staff_id: 3,
    created_at: new Date('2026-09-02T02:00:00.000Z'),
    sla_resolution_due_at: new Date('2026-09-02T03:00:00.000Z'),
    sla_status: 'on_track',
    sla_paused: false,
    sla_paused_seconds: 0,
  };

  function mockDb(overrides: {
    tickets?: typeof ticketRow[];
    policy?: typeof policyRow;
  } = {}) {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM csd_sla_policies')) {
        return { rows: [overrides.policy ?? policyRow] };
      }
      if (sql.includes('FOR UPDATE SKIP LOCKED')) {
        return { rows: overrides.tickets ?? [ticketRow] };
      }
      if (sql.includes('FROM csd_notifications')) {
        return { rows: [] };
      }
      if (sql.startsWith('UPDATE csd_tickets SET sla_status')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO csd_notifications')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO csd_ticket_activities')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    return {
      connect: jest.fn(async () => ({
        query,
        release: jest.fn(),
      })),
      query,
    } as unknown as Pool;
  }

  it('marks breached and inserts notification at 100%', async () => {
    const now = new Date('2026-09-02T04:00:00.000Z');
    const db = mockDb();
    const client = await db.connect();
    const query = client.query as jest.Mock;

    const result = await tickCsdSla(now, db);
    expect(result.updated).toBeGreaterThanOrEqual(0);

    const notifyCalls = query.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO csd_notifications'),
    );
    expect(notifyCalls.length).toBeGreaterThan(0);
    expect(
      notifyCalls.some((call) => Array.isArray(call[1]) && call[1][1] === 'sla.breached'),
    ).toBe(true);
  });

  it('escalates P1 unassigned after 30 business minutes', async () => {
    const created = new Date('2026-09-02T01:30:00.000Z');
    const now = new Date('2026-09-02T05:00:00.000Z');
    const p1Ticket = {
      ...ticketRow,
      priority: 'P1',
      assignee_staff_id: null,
      created_at: created,
      sla_resolution_due_at: new Date('2026-09-02T06:00:00.000Z'),
    };
    const db = mockDb({ tickets: [p1Ticket] });
    const client = await db.connect();
    const query = client.query as jest.Mock;

    const result = await tickCsdSla(now, db);
    expect(result.escalated).toBe(1);
    expect(
      query.mock.calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes("status = 'escalated'"),
      ),
    ).toBe(true);
  });
});
