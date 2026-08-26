import { B2bProjectsService } from './b2b-projects.service';
import { PTT_OPERATING_COMPANY_ID } from './b2b-projects.constants';

describe('B2bProjectsService.create', () => {
  it('stamps owner_company_id PTT', async () => {
    const repo = {
      insertProject: jest.fn(async (row: { owner_company_id: string; code: string }) => ({
        id: 'new',
        ...row,
        name: 'SEO HN',
        status: 'draft',
        business_hours_json: {},
        sla_json: {},
        commission_json: { first_touch_pct: 30, closer_pct: 70 },
        ai_call_enabled: false,
        manual_ingest_enabled: true,
      })),
    };
    const svc = new B2bProjectsService(repo as never);
    const created = await svc.create({ code: 'seo-hn', name: 'SEO HN' });
    expect(repo.insertProject).toHaveBeenCalledWith(
      expect.objectContaining({ owner_company_id: PTT_OPERATING_COMPANY_ID, code: 'seo-hn' }),
    );
    expect(created.owner_company_id).toBe(PTT_OPERATING_COMPANY_ID);
  });
});

describe('B2bProjectsService.replaceStaff', () => {
  it('rejects staff without can_receive_leads', async () => {
    const repo = {
      getProject: jest.fn(async () => ({ id: 'p1' })),
      listLeadEligibleStaffIds: jest.fn(async () => [2]),
      listProjectStaff: jest.fn(async () => []),
      replaceStaff: jest.fn(),
    };
    const svc = new B2bProjectsService(repo as never);
    await expect(svc.replaceStaff('p1', [{ staff_id: 9 }])).rejects.toMatchObject({
      response: { error: 'staff_not_lead_eligible', staff_ids: [9] },
    });
    expect(repo.replaceStaff).not.toHaveBeenCalled();
  });

  it('allows already-assigned staff even if flag is off', async () => {
    const repo = {
      getProject: jest.fn(async () => ({ id: 'p1' })),
      listLeadEligibleStaffIds: jest.fn(async () => []),
      listProjectStaff: jest.fn(async () => [{ staff_id: 9 }]),
      replaceStaff: jest.fn(async () => undefined),
    };
    const svc = new B2bProjectsService(repo as never);
    await expect(svc.replaceStaff('p1', [{ staff_id: 9, assign_enabled: true }])).resolves.toEqual({
      ok: true,
    });
    expect(repo.replaceStaff).toHaveBeenCalled();
  });
});
