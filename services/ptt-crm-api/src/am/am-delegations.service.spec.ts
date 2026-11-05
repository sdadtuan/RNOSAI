import { AmDelegationsService } from './am-delegations.service';

const DELEGATION_ID = '19d722af-0000-4000-8000-0000000000aa';

describe('AmDelegationsService', () => {
  const db = { query: jest.fn() };
  const staffAuth = {
    hasCap: jest.fn(
      (caps: Array<{ section: string; action: string }>, section: string, action: string) =>
        caps.some((c) => c.section === section && c.action === action),
    ),
  };

  let service: AmDelegationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    service = new AmDelegationsService(db as never, staffAuth as never);
  });

  it('rejects self-delegation', async () => {
    await expect(
      service.create({ to_staff_id: 7, starts_on: '2026-09-05', ends_on: '2026-09-10' }, 7),
    ).rejects.toMatchObject({ response: { error: 'delegation_self' } });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects ends_on before starts_on', async () => {
    await expect(
      service.create({ to_staff_id: 8, starts_on: '2026-09-10', ends_on: '2026-09-05' }, 7),
    ).rejects.toMatchObject({ error: 'ends_before_starts' });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('edit cannot set from_staff_id to another staff', async () => {
    await expect(
      service.create(
        { from_staff_id: 3, to_staff_id: 8, starts_on: '2026-09-05', ends_on: '2026-09-10' },
        7,
        [{ section: 'crm_am', action: 'edit' }],
      ),
    ).rejects.toMatchObject({ error: 'missing_cap', action: 'manage' });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('manage may set from_staff_id and resolves to_staff_id via crm_staff', async () => {
    db.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      if (/FROM crm_staff WHERE id/i.test(text)) {
        return { rows: [{ id: Number(params?.[0]) }], rowCount: 1 };
      }
      if (/INSERT INTO crm_am_delegations/i.test(text)) {
        return {
          rows: [
            {
              id: DELEGATION_ID,
              from_staff_id: 3,
              to_staff_id: 8,
              starts_on: '2026-09-05',
              ends_on: '2026-09-10',
              reason: 'nghỉ phép',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const row = await service.create(
      {
        from_staff_id: 3,
        to_staff_id: 8,
        starts_on: '2026-09-05',
        ends_on: '2026-09-10',
        reason: 'nghỉ phép',
      },
      7,
      [{ section: 'crm_am', action: 'manage' }],
    );
    expect(row.from_staff_id).toBe(3);
    expect(row.to_staff_id).toBe(8);
    expect(db.query.mock.calls.some(([sql]) => /insert into crm_am_delegations/i.test(String(sql)))).toBe(
      true,
    );
  });

  it('lists crm_staff ids for roster mapping', async () => {
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/FROM crm_staff cs/i.test(text)) {
        return { rows: [{ id: 42, email: 'am@ptt.vn', display_name: 'AM One' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const out = await service.list(7, [{ section: 'crm_am', action: 'edit' }]);
    expect(out.staff).toEqual([{ id: 42, email: 'am@ptt.vn', display_name: 'AM One' }]);
  });

  it('cancel sets ends_on to yesterday for own active row', async () => {
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/UPDATE crm_am_delegations/i.test(text)) {
        return {
          rows: [
            {
              id: DELEGATION_ID,
              from_staff_id: 7,
              to_staff_id: 8,
              starts_on: '2026-09-01',
              ends_on: '2026-09-04',
              reason: null,
            },
          ],
          rowCount: 1,
        };
      }
      return {
        rows: [
          {
            id: DELEGATION_ID,
            from_staff_id: 7,
            to_staff_id: 8,
            starts_on: '2026-09-01',
            ends_on: '2026-09-10',
            reason: null,
          },
        ],
        rowCount: 1,
      };
    });
    const row = await service.cancel(DELEGATION_ID, 7, [{ section: 'crm_am', action: 'edit' }]);
    expect(row.ends_on).toBe('2026-09-04');
    const updateSql = String(db.query.mock.calls.find(([sql]) => /UPDATE/i.test(String(sql)))?.[0] ?? '');
    expect(updateSql).toMatch(/CURRENT_DATE - 1/);
    expect(updateSql).toMatch(/ends_on >= CURRENT_DATE/);
    expect(updateSql).toMatch(/LEAST\(starts_on/);
  });
});
