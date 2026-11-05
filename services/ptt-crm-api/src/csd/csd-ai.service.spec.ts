import { CsdAiService } from './csd-ai.service';

describe('CsdAiService', () => {
  const aiRepo = { insert: jest.fn() };
  const ticketsRepo = {
    get: jest.fn(),
    listComments: jest.fn(),
  };
  const tickets = {
    create: jest.fn(),
    findBySource: jest.fn(),
  };
  const chatRepo = {
    listMessages: jest.fn(),
  };
  const emailService = { send: jest.fn() };

  let svc: CsdAiService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PTT_CSD_LLM = '0';
    aiRepo.insert.mockResolvedValue('ai-1');
    svc = new CsdAiService(aiRepo as never, ticketsRepo as never, chatRepo as never, tickets as never);
  });

  it('draftReply does not call email service (AT-AI-01)', async () => {
    ticketsRepo.get.mockResolvedValue({
      id: 't1',
      code: 'PTT-2026-000001',
      title: 'Yêu cầu báo cáo tháng 8',
      ticket_type: 'request',
      priority: 'P3',
    });
    ticketsRepo.listComments.mockResolvedValue([]);

    const out = await svc.draftReply(3, 't1');

    expect(out.body_text).toMatch(/PTT-2026-000001/);
    expect(aiRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ feature: 'ticket_draft_reply', actor_staff_id: 3 }),
    );
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('summarizeChat logs ai interaction', async () => {
    chatRepo.listMessages.mockResolvedValue([
      { body_text: 'Khách hỏi tiến độ ads', visibility: 'client' },
    ]);

    const out = await svc.summarizeChat(3, 'c1', '24h');

    expect(out.summary).toMatch(/ads/i);
    expect(out.ai_interaction_id).toBe('ai-1');
    expect(aiRepo.insert).toHaveBeenCalled();
  });
});
