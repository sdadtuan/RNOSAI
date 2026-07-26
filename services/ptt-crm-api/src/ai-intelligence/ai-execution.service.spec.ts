import { AiExecutionService } from './ai-execution.service';

describe('AiExecutionService', () => {
  const leadScore = {
    scoreLead: jest.fn().mockResolvedValue({
      data: {
        score: 72,
        confidence: 0.8,
        explainability: { factors: [{ label: '+ Meta' }], flags: [], score_band: 'hot' },
        agent_run_id: 'run-1',
      },
      meta: { request_id: 'req-1' },
      errors: [],
    }),
  };

  const audit = { wrap: jest.fn() };
  const aiConfig = { llmModel: 'gpt-4o-mini' };
  const timeline = { buildAiContext: jest.fn().mockResolvedValue([]) };

  let execution: AiExecutionService;

  beforeEach(() => {
    jest.clearAllMocks();
    execution = new AiExecutionService(
      leadScore as never,
      audit as never,
      aiConfig as never,
      timeline as never,
    );
  });

  it('scoreLead delegates to AiLeadScoreService', async () => {
    await execution.scoreLead({ actorId: 'staff-1' }, 99);
    expect(leadScore.scoreLead).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 99, actorId: 'staff-1' }),
    );
  });
});
