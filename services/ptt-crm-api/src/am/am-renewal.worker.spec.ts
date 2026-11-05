import { AmRenewalWorker } from './am-renewal.worker';

const CLIENT_ID = '19d722af-0000-4000-8000-000000000001';
const AS_OF = '2026-09-05';
const ENDS_PLUS_90 = '2026-12-04';

type QueryFn = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

describe('AmRenewalWorker', () => {
  const db: { query: jest.MockedFunction<QueryFn> } = {
    query: jest.fn(async (_sql: string) => ({ rows: [], rowCount: 0 })),
  };

  let worker: AmRenewalWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockImplementation(async (_sql: string) => ({ rows: [], rowCount: 0 }));
    worker = new AmRenewalWorker(db as never);
  });

  it('inserts when ends_on is as_of+90 and no open case; skips when already open', async () => {
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_contracts/i.test(text) && /select/i.test(text)) {
        return {
          rows: [
            {
              id: 84,
              agency_client_id: CLIENT_ID,
              status: 'active',
              ends_on: ENDS_PLUS_90,
            },
          ],
          rowCount: 1,
        };
      }
      if (/from crm_am_renewal_cases/i.test(text) && /select/i.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (/insert into crm_am_renewal_cases/i.test(text)) {
        return { rows: [{ id: '19d722af-0000-4000-8000-0000000000aa' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const first = await worker.run({ asOf: AS_OF });
    expect(first.inserted).toBe(1);
    expect(first.skipped).toBe(0);
    expect(db.query.mock.calls.some(([sql]) => /insert into crm_am_renewal_cases/i.test(String(sql)))).toBe(
      true,
    );

    db.query.mockClear();
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_contracts/i.test(text) && /select/i.test(text)) {
        return {
          rows: [
            {
              id: 84,
              agency_client_id: CLIENT_ID,
              status: 'active',
              ends_on: ENDS_PLUS_90,
            },
          ],
          rowCount: 1,
        };
      }
      if (/from crm_am_renewal_cases/i.test(text) && /select/i.test(text)) {
        return { rows: [{ id: '19d722af-0000-4000-8000-0000000000aa' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const second = await worker.run({ asOf: AS_OF });
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(1);
    expect(db.query.mock.calls.some(([sql]) => /insert into crm_am_renewal_cases/i.test(String(sql)))).toBe(
      false,
    );
  });

  it('inserts renewal.ending when ends_on is in the 14-day window and owner is set', async () => {
    const notifications = { notify: jest.fn() };
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_contracts/i.test(text) && /select/i.test(text)) {
        return {
          rows: [
            {
              id: 84,
              agency_client_id: CLIENT_ID,
              status: 'active',
              ends_on: '2026-09-19',
              client_name: 'EduNext',
              contract_ref: 'HD-84',
              account_owner_staff_id: 11,
            },
          ],
          rowCount: 1,
        };
      }
      if (/from crm_am_renewal_cases/i.test(text) && /select/i.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (/insert into crm_am_renewal_cases/i.test(text)) {
        return { rows: [{ id: '19d722af-0000-4000-8000-0000000000aa' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    worker = new AmRenewalWorker(db as never, notifications as never);

    const out = await worker.run({ asOf: AS_OF });

    expect(out.inserted).toBe(1);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        staff_id: 11,
        kind: 'renewal.ending',
        href: '/crm/account-management/renewals',
      }),
    );
    expect(String(notifications.notify.mock.calls[0][0].title)).toMatch(/EduNext/);
    expect(String(notifications.notify.mock.calls[0][0].title)).not.toMatch(/\d{2,}\.\d{3}/);
  });

  it('inserts renewal.ending when ends_on is a Date 14 days from asOf', async () => {
    const notifications = { notify: jest.fn() };
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_contracts/i.test(text) && /select/i.test(text)) {
        return {
          rows: [
            {
              id: 84,
              agency_client_id: CLIENT_ID,
              status: 'active',
              ends_on: new Date('2026-09-19T00:00:00Z'),
              client_name: 'EduNext',
              contract_ref: 'HD-84',
              account_owner_staff_id: 11,
            },
          ],
          rowCount: 1,
        };
      }
      if (/from crm_am_renewal_cases/i.test(text) && /select/i.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (/insert into crm_am_renewal_cases/i.test(text)) {
        return { rows: [{ id: '19d722af-0000-4000-8000-0000000000aa' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    worker = new AmRenewalWorker(db as never, notifications as never);

    await worker.run({ asOf: AS_OF });

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        staff_id: 11,
        kind: 'renewal.ending',
        href: '/crm/account-management/renewals',
      }),
    );
  });

  it('does not notify renewal.ending when account owner is null', async () => {
    const notifications = { notify: jest.fn() };
    db.query.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (/from crm_contracts/i.test(text) && /select/i.test(text)) {
        return {
          rows: [
            {
              id: 84,
              agency_client_id: CLIENT_ID,
              status: 'active',
              ends_on: '2026-09-19',
              client_name: 'EduNext',
              contract_ref: 'HD-84',
              account_owner_staff_id: null,
            },
          ],
          rowCount: 1,
        };
      }
      if (/from crm_am_renewal_cases/i.test(text) && /select/i.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (/insert into crm_am_renewal_cases/i.test(text)) {
        return { rows: [{ id: '19d722af-0000-4000-8000-0000000000aa' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    worker = new AmRenewalWorker(db as never, notifications as never);

    await worker.run({ asOf: AS_OF });

    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
