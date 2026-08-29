import { ServiceUnavailableException } from '@nestjs/common';
import { IntakeSalesKitLlmService } from './intake-sales-kit-llm.service';
import type { SalesKitRulesOutput } from './intake-sales-kit-rules.util';

const RULES_REPLY = 'Còn 24 điểm để Go. Ưu tiên hỏi ngân sách.';

function rulesPayload(overrides: Partial<SalesKitRulesOutput> = {}): SalesKitRulesOutput {
  return {
    reply_vi: RULES_REPLY,
    apply: {},
    gap: { total: 0, to_go: 24, weakest: ['budget'] },
    citations: [],
    stub_mode: true,
    ...overrides,
  };
}

describe('IntakeSalesKitLlmService', () => {
  const llm = { completeJson: jest.fn() };
  const agentRuns = { tableReady: jest.fn().mockResolvedValue(false), insertRun: jest.fn() };
  const aiConfig = {
    intakeSalesKitLlmEnabled: false,
    llmApiKey: 'sk-test',
    llmModel: 'gpt-4o-mini',
  };

  function svc() {
    return new IntakeSalesKitLlmService(llm as never, aiConfig as never, agentRuns as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    aiConfig.intakeSalesKitLlmEnabled = false;
    aiConfig.llmApiKey = 'sk-test';
    agentRuns.tableReady.mockResolvedValue(false);
  });

  it('does not call completeJson when flag is off', async () => {
    aiConfig.intakeSalesKitLlmEnabled = false;
    const rules = rulesPayload();
    const out = await svc().polish({
      intent: 'next_question',
      rules,
      citations: [],
      industry: 'BĐS',
      service_slug: 'dich-vu-seo-tong-the',
    });
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(out.reply_vi).toBe(RULES_REPLY);
    expect(out.stub_mode).toBe(true);
  });

  it('strips invented money when flag is on and no citation', async () => {
    aiConfig.intakeSalesKitLlmEnabled = true;
    llm.completeJson.mockResolvedValue({
      parsed: { reply_vi: 'Gói 20 triệu/tháng, chốt luôn.' },
      tokenUsage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      modelName: 'gpt-4o-mini',
      stubMode: false,
    });
    const out = await svc().polish({
      intent: 'freeform',
      rules: rulesPayload(),
      citations: [],
      industry: '',
      service_slug: 'dich-vu-seo-tong-the',
    });
    expect(llm.completeJson).toHaveBeenCalled();
    expect(out.reply_vi).not.toMatch(/20\s*triệu/i);
    expect(out.reply_vi).toMatch(/số đã ẩn|Còn 24 điểm/i);
  });

  it('returns rules payload when completeJson times out', async () => {
    aiConfig.intakeSalesKitLlmEnabled = true;
    llm.completeJson.mockRejectedValue(
      new ServiceUnavailableException({ error: 'llm_timeout', message: 'LLM timeout' }),
    );
    const rules = rulesPayload({
      next_question: { key: 'seo_domain', text: 'Website hiện tại?', tab: 'discovery' },
    });
    const out = await svc().polish({
      intent: 'next_question',
      rules,
      citations: [],
      industry: '',
      service_slug: 'dich-vu-seo-tong-the',
    });
    expect(out.reply_vi).toBe(RULES_REPLY);
    expect(out.stub_mode).toBe(true);
    expect(out.next_question?.key).toBe('seo_domain');
  });

  it('strips invented money from next_question.text when flag is on and no citation', async () => {
    aiConfig.intakeSalesKitLlmEnabled = true;
    llm.completeJson.mockResolvedValue({
      parsed: {
        reply_vi: 'Còn 24 điểm để Go. Ưu tiên hỏi ngân sách.',
        next_question_text: 'Ngân sách khoảng 20 triệu/tháng có phù hợp không?',
      },
      tokenUsage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      modelName: 'gpt-4o-mini',
      stubMode: false,
    });
    const rules = rulesPayload({
      next_question: { key: 'budget', text: 'Ngân sách dự kiến?', tab: 'discovery' },
    });
    const out = await svc().polish({
      intent: 'next_question',
      rules,
      citations: [],
      industry: '',
      service_slug: 'dich-vu-seo-tong-the',
    });
    expect(out.reply_vi).not.toMatch(/20\s*triệu/i);
    expect(out.next_question?.text).not.toMatch(/20\s*triệu/i);
    expect(out.next_question?.text).toMatch(/số đã ẩn|Ngân sách dự kiến/i);
  });

  it('does not call LLM for ask_library without citations', async () => {
    aiConfig.intakeSalesKitLlmEnabled = true;
    const out = await svc().polish({
      intent: 'ask_library',
      rules: rulesPayload({ reply_vi: 'Chưa có file trong kho. Không bịa giá/case.' }),
      citations: [],
      industry: '',
      service_slug: 'dich-vu-seo-tong-the',
    });
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(out.reply_vi).toMatch(/Chưa có file/i);
    expect(out.stub_mode).toBe(true);
  });
});
