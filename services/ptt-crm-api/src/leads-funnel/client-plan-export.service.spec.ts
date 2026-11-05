import { LeadsFunnelService } from './leads-funnel.service';
import { LIBREOFFICE_MISSING_NOTE } from './client-plan-pptx.util';

describe('exportClientPlan', () => {
  const pgRepo = {
    getPresalesSnapshot: jest.fn(),
    getOrCreatePreliminaryPlan: jest.fn(),
    getLeadCompanyName: jest.fn(),
    getLeadIndustryName: jest.fn(),
    getLeadPlanContact: jest.fn(),
    fetchLeadRow: jest.fn(),
  };
  const intake = { listSessions: jest.fn() };

  function service() {
    return new LeadsFunnelService(
      pgRepo as never,
      { presalesOnLead: true, mktAiModel: '', mktAiAutoCustomerEmailEnabled: false } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      intake as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    pgRepo.getPresalesSnapshot.mockResolvedValue({
      presales: { id: 9, service_slug: 'seo', stage: 'consult', handoff_status: '' },
      tasks: { lead: [{ form_data: { niche: 'Ảnh cưới', need: 'ít lịch' } }], consult: [] },
      progress: { consult: { total: 1, done: 0 } },
    });
    pgRepo.fetchLeadRow.mockResolvedValue({ full_name: 'Quý' });
    intake.listSessions.mockResolvedValue({ sessions: [] });
    pgRepo.getLeadCompanyName.mockResolvedValue('Quý Nguyễn Studio');
    pgRepo.getLeadIndustryName.mockResolvedValue('Ảnh cưới');
    pgRepo.getLeadPlanContact.mockResolvedValue({
      company_name: 'Quý Nguyễn Studio',
      address: 'Q1',
      phone: '0900000000',
      email: 'studio@example.com',
    });
  });

  it('blocks the file when the R5 gate is red', async () => {
    pgRepo.getOrCreatePreliminaryPlan.mockResolvedValue({
      name: '',
      north_star: '',
      objectives: '',
      strategy_framework_json: {},
      target_market_prof_json: {},
    });
    await expect(service().exportClientPlan(7, { sofficePath: null })).rejects.toBeTruthy();
    expect(pgRepo.getLeadPlanContact).not.toHaveBeenCalled();
  });

  it('returns the client pptx name even when the quote gate would still be closed', async () => {
    pgRepo.getOrCreatePreliminaryPlan.mockResolvedValue({
      name: 'KH MKT sơ bộ',
      north_star: 'Tăng lịch chụp',
      objectives: '',
      strategy_framework_json: {
        market_message: 'Concept riêng',
        media_reach: 'Facebook',
        conversion_strategy: 'gọi xác nhận',
        lifecycle_extension: '[cần xác nhận]',
      },
      target_market_prof_json: { client_brief: JSON.stringify({ saved_after_ai: false, usp: 'Concept riêng', goal: 'Tăng lịch', channels: 'Facebook' }) },
    });
    const out = await service().exportClientPlan(7, { sofficePath: null });
    expect(out?.filename).toBe('PTT_QuyNguyenStudio_KeHoachMarketing.pptx');
    expect(out?.pptx.subarray(0, 2).toString()).toBe('PK');
    expect(out?.note).toBe(LIBREOFFICE_MISSING_NOTE);
    expect(out?.pdf).toBeNull();
  });
});
