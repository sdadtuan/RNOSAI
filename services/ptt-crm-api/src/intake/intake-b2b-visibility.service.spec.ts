import { IntakeB2bVisibilityService } from './intake-b2b-visibility.service';

describe('IntakeB2bVisibilityService', () => {
  const leads = { getLeadById: jest.fn() };
  const b2bScope = { assertLeadVisible: jest.fn() };

  function svc(b2bProjectOs = true) {
    return new IntakeB2bVisibilityService(
      { b2bProjectOs } as never,
      leads as never,
      b2bScope as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    leads.getLeadById.mockResolvedValue({ id: 5, owner_id: 1 });
    b2bScope.assertLeadVisible.mockResolvedValue(undefined);
  });

  it('skips B2B scope when JWT staff id is unresolved (staffId 0)', async () => {
    await svc().assertLeadVisible(5, { staffId: 0, caps: [] });
    expect(leads.getLeadById).not.toHaveBeenCalled();
    expect(b2bScope.assertLeadVisible).not.toHaveBeenCalled();
  });

  it('scopes a resolved staff actor against B2B', async () => {
    await svc().assertLeadVisible(5, {
      staffId: 7,
      caps: [{ section: 'crm_leads', action: 'view' }],
      positionCode: 'am',
    });
    expect(leads.getLeadById).toHaveBeenCalledWith(5);
    expect(b2bScope.assertLeadVisible).toHaveBeenCalled();
  });
});
