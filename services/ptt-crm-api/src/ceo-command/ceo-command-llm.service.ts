import { Injectable, Logger } from '@nestjs/common';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { AiLlmClient } from '../ai-intelligence/ai-llm.client';
import { assertReplyNumbersInFacts } from './ceo-command.util';
import { buildCeoSystemPrompt } from './ceo-command-llm.util';

@Injectable()
export class CeoCommandLlmService {
  private readonly logger = new Logger(CeoCommandLlmService.name);

  constructor(
    private readonly llm: AiLlmClient,
    private readonly aiConfig: AiIntelligenceConfigService,
  ) {}

  async polish(input: {
    reply_vi: string;
    facts_json: Record<string, unknown>;
    intent: string;
  }): Promise<{ reply_vi: string; stub_mode: boolean; model_name: string }> {
    const factsReply = input.reply_vi;
    if (!this.aiConfig.ceoCommandLlmEnabled) {
      return { reply_vi: factsReply, stub_mode: true, model_name: 'facts' };
    }

    try {
      const { parsed, modelName, stubMode } = await this.llm.completeJson({
        systemPrompt: buildCeoSystemPrompt(),
        userContent: JSON.stringify({
          facts_json: input.facts_json,
          reply_vi: input.reply_vi,
          intent: input.intent,
        }),
        model: this.aiConfig.ceoCommandLlmModel,
        apiKey: this.aiConfig.ceoCommandLlmApiKey ?? undefined,
        baseUrl: this.aiConfig.ceoCommandLlmBaseUrl ?? undefined,
        timeoutMs: this.aiConfig.ceoCommandLlmTimeoutMs,
        stubJson: () => ({ reply_vi: factsReply }),
      });

      const candidate = String((parsed as { reply_vi?: string })?.reply_vi ?? factsReply).trim() || factsReply;
      if (!assertReplyNumbersInFacts(candidate, input.facts_json)) {
        return { reply_vi: factsReply, stub_mode: true, model_name: modelName ?? 'facts' };
      }
      return {
        reply_vi: candidate,
        stub_mode: Boolean(stubMode),
        model_name: modelName ?? 'oss',
      };
    } catch (e) {
      this.logger.warn(`CEO LLM polish failed: ${String((e as Error).message)}`);
      return { reply_vi: factsReply, stub_mode: true, model_name: 'facts' };
    }
  }
}
