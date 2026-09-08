import { tickQuoteExpiry } from './quote-expiry.worker';

type QuoteRow = {
  id: number;
  status: string;
  current_version_id?: string | null;
  proposal_valid_until?: string | Date | null;
  version_valid_until?: string | Date | null;
};

type QueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;

function mockDb(rows: QuoteRow[]) {
  const updates: Array<{ id: number; status: string }> = [];
  const query: jest.MockedFunction<QueryFn> = jest.fn(async (sql: string, params: unknown[] = []) => {
    const text = String(sql);
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
      return { rows: [] };
    }
    if (/FROM crm_proposals/i.test(text) && /SELECT/i.test(text)) {
      const allowed = Array.isArray(params[0]) ? (params[0] as string[]) : [];
      return {
        rows: rows.filter((row) => !allowed.length || allowed.includes(row.status)),
        rowCount: rows.length,
      };
    }
    if (/UPDATE crm_proposals/i.test(text) && /expired/i.test(text)) {
      const id = Number(params[0]);
      updates.push({ id, status: 'expired' });
      const row = rows.find((item) => item.id === id);
      if (row) row.status = 'expired';
      return { rows: [{ id }], rowCount: 1 };
    }
    if (/INSERT INTO crm_quote_activity/i.test(text)) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  return { query, updates };
}

/** 2026-09-08 00:30 ICT — still 2026-09-07 in UTC. */
const ICT_NEXT_DAY = new Date('2026-09-07T17:30:00.000Z');

describe('tickQuoteExpiry', () => {
  it('expires overdue sent quotes using Asia/Ho_Chi_Minh, not UTC', async () => {
    const db = mockDb([
      {
        id: 11,
        status: 'sent',
        current_version_id: 'ver-11',
        proposal_valid_until: '2026-09-07',
        version_valid_until: null,
      },
    ]);

    const result = await tickQuoteExpiry(ICT_NEXT_DAY, db);

    expect(result.expired).toBe(1);
    expect(db.updates).toEqual([{ id: 11, status: 'expired' }]);
    expect(
      db.query.mock.calls.some(
        ([sql, params]) =>
          /UPDATE crm_proposals/i.test(String(sql)) &&
          /status\s*=\s*'expired'/i.test(String(sql)) &&
          Array.isArray(params) &&
          params[0] === 11,
      ),
    ).toBe(true);
  });

  it('leaves accepted quotes unchanged when valid_until is past', async () => {
    const db = mockDb([
      {
        id: 22,
        status: 'accepted',
        proposal_valid_until: '2020-01-01',
      },
    ]);

    const result = await tickQuoteExpiry(ICT_NEXT_DAY, db);

    expect(result.expired).toBe(0);
    expect(db.updates).toEqual([]);
    expect(db.query.mock.calls.some(([sql]) => /UPDATE crm_proposals/i.test(String(sql)))).toBe(
      false,
    );
  });

  it('leaves draft quotes unchanged when valid_until is past', async () => {
    const db = mockDb([
      {
        id: 33,
        status: 'draft',
        proposal_valid_until: '2020-01-01',
      },
    ]);

    const result = await tickQuoteExpiry(ICT_NEXT_DAY, db);

    expect(result.expired).toBe(0);
    expect(db.updates).toEqual([]);
    expect(db.query.mock.calls.some(([sql]) => /UPDATE crm_proposals/i.test(String(sql)))).toBe(
      false,
    );
  });
});
