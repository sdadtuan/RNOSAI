import { ServiceUnavailableException } from '@nestjs/common';
import { IntakeScoreSuggestService } from './intake-score-suggest.service';

const CORPUS_DISCOVERY = 'agency cũ không đạt KPI tháng 3';
const CORPUS_WIN = 'ngân sách 30 triệu';
const CORPUS_COMMIT = 'gửi báo giá tuần sau';

function sessionWithCorpus() {
  return {
    id: 42,
    answers_json: {
      discovery_responses: { phone_pain_point: { answer: CORPUS_DISCOVERY } },
      win_intel: { incumbent: { answer: CORPUS_WIN } },
    },
    commitments_json: [{ detail: CORPUS_COMMIT }],
    bant_json: {},
  };
}

describe('IntakeScoreSuggestService', () => {
  const llm = { completeJson: jest.fn() };
  const agentRuns = { tableReady: jest.fn().mockResolvedValue(false), insertRun: jest.fn() };
  const intake = { getSession: jest.fn() };
  const aiConfig = {
    intakeLlmScoreEnabled: true,
    llmModel: 'gpt-4o-mini',
    llmApiKey: 'sk-test',
    intakeSalesKitLlmTimeoutMs: 8000,
  };

  function svc() {
    return new IntakeScoreSuggestService(
      intake as never,
      llm as never,
      aiConfig as never,
      agentRuns as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    aiConfig.intakeLlmScoreEnabled = true;
    agentRuns.tableReady.mockResolvedValue(false);
    intake.getSession.mockResolvedValue(sessionWithCorpus());
  });

  it('throws llm_score_disabled when flag is off', async () => {
    aiConfig.intakeLlmScoreEnabled = false;
    await expect(svc().suggestScores(42)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(svc().suggestScores(42)).rejects.toMatchObject({
      response: { error: 'llm_score_disabled' },
    });
    expect(llm.completeJson).not.toHaveBeenCalled();
  });

  it('returns stub without calling LLM when corpus is shorter than 20', async () => {
    intake.getSession.mockResolvedValue({
      id: 7,
      answers_json: {},
      commitments_json: [],
      bant_json: {},
    });
    const out = await svc().suggestScores(7);
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(out).toEqual({ stub_mode: true, suggestions: {}, rejected: [] });
  });

  it('keeps suggestions whose quote is in the form corpus', async () => {
    llm.completeJson.mockResolvedValue({
      parsed: {
        bant: { need: { score: 3, quote: 'không đạt KPI' } },
        win: { incumbent: { score: 4, quote: 'ngân sách 30 triệu' } },
      },
      tokenUsage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      modelName: 'gpt-4o-mini',
      stubMode: false,
    });
    const out = await svc().suggestScores(42);
    expect(llm.completeJson).toHaveBeenCalled();
    const userContent = String(llm.completeJson.mock.calls[0][0].userContent);
    expect(userContent).toContain(CORPUS_DISCOVERY);
    expect(userContent).toContain(CORPUS_WIN);
    expect(userContent).toContain(CORPUS_COMMIT);
    expect(out.stub_mode).toBe(false);
    expect(out.suggestions.bant?.need).toEqual({ score: 3, quote: 'không đạt KPI' });
    expect(out.suggestions.win?.incumbent).toEqual({
      score: 4,
      quote: 'ngân sách 30 triệu',
    });
    expect(out.rejected).toHaveLength(0);
  });

  it('rejects quotes that are not in the form and coerces string scores', async () => {
    llm.completeJson.mockResolvedValue({
      parsed: {
        bant: { need: { score: '4', quote: 'không đạt KPI' } },
        win: { incumbent: { score: 4, quote: 'top 1 google' } },
      },
      tokenUsage: {},
      modelName: 'gpt-4o-mini',
      stubMode: false,
    });
    const out = await svc().suggestScores(42);
    expect(out.suggestions.bant?.need).toEqual({ score: 4, quote: 'không đạt KPI' });
    expect(out.suggestions.win?.incumbent).toBeUndefined();
    expect(out.rejected).toEqual([
      { layer: 'win', key: 'incumbent', reason: 'quote_not_in_form' },
    ]);
  });

  it('returns empty stub_mode when completeJson throws', async () => {
    llm.completeJson.mockRejectedValue(new ServiceUnavailableException({ error: 'llm_timeout' }));
    const out = await svc().suggestScores(42);
    expect(out).toEqual({ stub_mode: true, suggestions: {}, rejected: [] });
  });
});
