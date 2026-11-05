import { AmSlaPoliciesService } from './am-sla-policies.service';

const POLICY_ID = '19d722af-0000-4000-8000-0000000000a1';

describe('AmSlaPoliciesService', () => {
  type QueryFn = (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

  const repo: { query: jest.MockedFunction<QueryFn> } = {
    query: jest.fn(async (_sql: string) => ({ rows: [], rowCount: 0 })),
  };
  const audit = { insert: jest.fn() };

  let service: AmSlaPoliciesService;
  let stored: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    stored = {
      id: POLICY_ID,
      name: 'AM default',
      first_response_minutes: 60,
      resolve_minutes: 480,
      pause_on_waiting_client: true,
      escalate_json: { '70': 'lead', '90': 'director', '100': 'executive' },
      workday_start: '08:30',
      workday_end: '17:30',
      workdays: [1, 2, 3, 4, 5],
      holidays: [],
    };
    repo.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      if (/INSERT INTO crm_am_sla_policies/i.test(text)) {
        stored = {
          ...stored,
          name: params?.[1],
          first_response_minutes: params?.[2],
          resolve_minutes: params?.[3],
        };
        return { rows: [stored], rowCount: 1 };
      }
      if (/UPDATE crm_am_sla_policies/i.test(text)) {
        const holidays = (params ?? []).find(
          (p) => Array.isArray(p) && typeof p[0] === 'string',
        ) as string[] | undefined;
        const workdays = (params ?? []).find(
          (p) => Array.isArray(p) && typeof p[0] === 'number',
        ) as number[] | undefined;
        const escalate = (params ?? []).find(
          (p) => p && typeof p === 'object' && !Array.isArray(p) && '70' in (p as object),
        );
        const times = (params ?? []).filter(
          (p) => typeof p === 'string' && /^\d{2}:\d{2}$/.test(p),
        ) as string[];
        if (holidays) stored.holidays = holidays;
        if (workdays) stored.workdays = workdays;
        if (escalate) stored.escalate_json = escalate;
        if (times[0]) stored.workday_start = times[0];
        if (times[1]) stored.workday_end = times[1];
        return { rows: [{ ...stored }], rowCount: 1 };
      }
      if (/FROM crm_am_sla_policies/i.test(text)) {
        return { rows: [stored], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    service = new AmSlaPoliciesService(repo as never, audit as never);
  });

  it('PATCH holidays, escalate, and work hours persist on GET', async () => {
    const patched = await service.patch(POLICY_ID, {
      holidays: ['2026-09-02', '2026-04-30'],
      escalate_json: { '70': 'lead', '90': 'director', '100': 'executive' },
      workday_start: '08:30',
      workday_end: '17:30',
      workdays: [1, 2, 3, 4, 5],
    });
    expect(repo.query.mock.calls.some(([sql]) => /UPDATE crm_am_sla_policies/i.test(String(sql)))).toBe(
      true,
    );

    const listed = await service.list();
    expect(listed.items[0].holidays).toEqual(['2026-09-02', '2026-04-30']);
    expect(listed.items[0].escalate_json).toEqual({
      '70': 'lead',
      '90': 'director',
      '100': 'executive',
    });
    expect(listed.items[0].workday_start).toBe('08:30');
    expect(listed.items[0].workday_end).toBe('17:30');
    expect(patched.holidays).toEqual(['2026-09-02', '2026-04-30']);
  });

  it('create applies VN calendar defaults', async () => {
    const out = await service.create({
      name: 'Standard',
      first_response_minutes: 30,
      resolve_minutes: 240,
    });
    expect(out.pause_on_waiting_client).toBe(true);
    expect(out.workday_start).toBe('08:30');
    expect(out.workday_end).toBe('17:30');
    expect(out.workdays).toEqual([1, 2, 3, 4, 5]);
    expect(out.escalate_json).toEqual({ '70': 'lead', '90': 'director', '100': 'executive' });
  });
});
