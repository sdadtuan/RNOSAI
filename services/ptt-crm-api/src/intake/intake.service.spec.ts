import { IntakeService } from './intake.service';

describe('IntakeService salesKitTurn library', () => {
  const session = {
    id: 12,
    lead_id: 5,
    service_slug: 'dich-vu-seo-tong-the',
    mode: 'phone',
    bant_json: {},
    answers_json: {},
  };

  const pg = { getSession: jest.fn().mockResolvedValue(session) };
  const visibility = { assertLeadVisible: jest.fn().mockResolvedValue(undefined) };
  const library = { retrieveForSession: jest.fn(), assertTurnRate: jest.fn() };
  const salesKitLlm = {
    polish: jest.fn(async ({ rules }: { rules: { reply_vi: string } }) => rules),
  };

  function svc() {
    return new IntakeService(
      pg as never,
      {} as never,
      visibility as never,
      {} as never,
      {} as never,
      {} as never,
      library as never,
      salesKitLlm as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    pg.getSession.mockResolvedValue(session);
    salesKitLlm.polish.mockImplementation(async ({ rules }: { rules: { reply_vi: string } }) => rules);
  });

  it('keeps empty-state when library has no hits', async () => {
    library.retrieveForSession.mockResolvedValue([]);
    const out = await svc().salesKitTurn(12, { intent: 'ask_library', message: 'đắt' });
    expect(out.citations).toEqual([]);
    expect(out.reply_vi).toMatch(/Chưa có file|kho/i);
    expect(library.retrieveForSession).toHaveBeenCalled();
    expect(salesKitLlm.polish).not.toHaveBeenCalled();
  });

  it('overrides reply_vi and citations from top hit', async () => {
    library.retrieveForSession.mockResolvedValue([
      {
        file_id: '1',
        file_name: 'qa.xlsx',
        folder_path: 'dich-vu-seo-tong-the/qa',
        excerpt: 'Q: đắt',
        score: 1.2,
        kind: 'qa',
        body: 'Q: đắt\nA: Neo gói TC',
        is_session: false,
      },
    ]);
    const out = await svc().salesKitTurn(12, { intent: 'ask_library', message: 'đắt' });
    expect(out.reply_vi).toBe('Neo gói TC');
    expect(out.citations).toHaveLength(1);
    expect(out.citations[0]?.file_name).toBe('qa.xlsx');
    expect(out.stub_mode).toBe(true);
    expect(library.assertTurnRate).toHaveBeenCalled();
  });

  it('skips retrieve when ask_library has no question text', async () => {
    const out = await svc().salesKitTurn(12, { intent: 'ask_library' });
    expect(library.retrieveForSession).not.toHaveBeenCalled();
    expect(out.citations).toEqual([]);
    expect(out.reply_vi).toMatch(/Gõ câu hỏi/i);
    expect(library.assertTurnRate).toHaveBeenCalled();
  });
});
