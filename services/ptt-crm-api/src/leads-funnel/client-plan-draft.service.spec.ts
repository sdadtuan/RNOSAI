import { readClientBrief } from './client-plan-brief.util';
import { LeadsFunnelService } from './leads-funnel.service';
import { PRESALES_AI_DRAFT_MODEL_KEY } from './presales-ai-draft-meta.util';

const PAGE = `<html><head><meta property="og:image" content="https://cdn.example/a.jpg"></head><body>đối thủ Studio B</body></html>`;

function readyBrief(patch: Record<string, unknown> = {}) {
  return {
    audience: '',
    usp: 'Concept riêng',
    goal: '40 lịch mỗi tháng',
    channels: 'Facebook, gọi xác nhận',
    retain: '',
    competitors: '',
    metrics: '',
    website: 'https://studio.example/',
    fanpage: '',
    saved_after_ai: true,
    human_edited_keys: [],
    ...patch,
  };
}

describe('generatePresalesMarketingPlanAiDraft', () => {
  const pgRepo = {
    getPresalesSnapshot: jest.fn(),
    getOrCreatePreliminaryPlan: jest.fn(),
    getLeadCompanyName: jest.fn(),
    fetchLeadRow: jest.fn(),
    patchMarketingPlan: jest.fn(),
    buildSnapshot: jest.fn(),
  };
  const intake = { listSessions: jest.fn() };
  const llm = { completeJson: jest.fn() };
  const mktAiAllow = { ensure: jest.fn() };
  const config = { mktAiAutoCustomerEmailEnabled: false, mktAiModel: 'gpt-4o', presalesOnLead: true };
  const aiConfig = { llmModel: 'gpt-4o-mini' };

  function service() {
    return new LeadsFunnelService(
      pgRepo as never,
      config as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      intake as never,
      llm as never,
      {} as never,
      {} as never,
      mktAiAllow as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      aiConfig as never,
    );
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    pgRepo.getPresalesSnapshot.mockResolvedValue({
      presales: { id: 9, service_slug: 'seo', stage: 'consult', handoff_status: '' },
      tasks: { lead: [{ form_data: { niche: 'Ảnh cưới', need: 'ít lịch' } }], consult: [] },
      progress: { lead: { total: 1, done: 1 }, consult: { total: 1, done: 1 } },
    });
    pgRepo.getLeadCompanyName.mockResolvedValue('Quý Nguyễn Studio');
    pgRepo.fetchLeadRow.mockResolvedValue({ full_name: 'Quý' });
    intake.listSessions.mockResolvedValue({ sessions: [] });
    mktAiAllow.ensure.mockResolvedValue(undefined);
    pgRepo.buildSnapshot.mockResolvedValue({ presales: { id: 9 } });
    pgRepo.patchMarketingPlan.mockImplementation(async (_id: number, body: { target_market_prof: Record<string, string> }) => ({
      id: 3,
      name: 'KH',
      north_star: '40 lịch mỗi tháng',
      objectives: 'ít lịch',
      strategy_framework_json: { market_message: 'Concept riêng', media_reach: 'Facebook', conversion_strategy: 'gọi' },
      target_market_prof_json: body.target_market_prof,
    }));
    llm.completeJson.mockImplementation(async ({ stubJson }: { stubJson: () => Record<string, unknown> }) => ({
      parsed: {
        ...stubJson(),
        target_market: 'cô dâu',
        competitors: 'Studio B',
        cover_image_url: 'https://cdn.example/a.jpg',
        north_star: '40 lịch mỗi tháng',
        market_message: 'Concept riêng',
        media_reach: 'Facebook',
        conversion_strategy: 'gọi xác nhận',
      },
      stubMode: true,
      modelName: 'gpt-4o-stub',
      tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }));
  });

  it('fetches the page once and calls the LLM once', async () => {
    pgRepo.getOrCreatePreliminaryPlan.mockResolvedValue({
      id: 3,
      name: '',
      north_star: '',
      objectives: '',
      strategy_framework_json: {},
      target_market_prof_json: { client_brief: JSON.stringify(readyBrief()) },
    });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html' } }),
    );

    const out = await service().generatePresalesMarketingPlanAiDraft(7);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(llm.completeJson).toHaveBeenCalledTimes(1);
    expect(llm.completeJson).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        imageUrls: ['https://cdn.example/a.jpg'],
      }),
    );
    const prof = pgRepo.patchMarketingPlan.mock.calls[0][1].target_market_prof as Record<string, string>;
    expect(readClientBrief(prof).saved_after_ai).toBe(false);
    expect(prof[PRESALES_AI_DRAFT_MODEL_KEY]).toBe('gpt-4o');
    expect(prof.client_plan_competitors).toBe('Studio B');
    expect(out?.ai.model).toBe('gpt-4o');
  });

  it('does not fetch and uses gpt-4o-mini when the brief has no page', async () => {
    pgRepo.getOrCreatePreliminaryPlan.mockResolvedValue({
      id: 3,
      name: '',
      north_star: '',
      objectives: '',
      strategy_framework_json: {},
      target_market_prof_json: { client_brief: JSON.stringify(readyBrief({ website: '', fanpage: '' })) },
    });
    const fetchMock = jest.spyOn(global, 'fetch');

    await service().generatePresalesMarketingPlanAiDraft(7);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(llm.completeJson).toHaveBeenCalledTimes(1);
    expect(llm.completeJson).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-4o-mini', imageUrls: [] }));
    const body = pgRepo.patchMarketingPlan.mock.calls[0][1];
    expect(body.strategy_framework.target_market).toBe('[cần xác nhận]');
    expect(body.target_market_prof.client_plan_competitors).toBe('[cần xác nhận]');
    expect(body.target_market_prof.client_plan_cover_image_url).toBe('');
    expect(body.target_market_prof[PRESALES_AI_DRAFT_MODEL_KEY]).toBe('gpt-4o-mini');
  });

  it('does not call the LLM when the brief is incomplete', async () => {
    pgRepo.getOrCreatePreliminaryPlan.mockResolvedValue({
      id: 3,
      name: '',
      north_star: '',
      objectives: '',
      strategy_framework_json: {},
      target_market_prof_json: { client_brief: JSON.stringify(readyBrief({ usp: '' })) },
    });

    await expect(service().generatePresalesMarketingPlanAiDraft(7)).rejects.toBeTruthy();
    expect(llm.completeJson).not.toHaveBeenCalled();
  });
});
