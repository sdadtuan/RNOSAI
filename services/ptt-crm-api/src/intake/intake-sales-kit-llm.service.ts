import { createHash } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AI_AUDIT_ERROR, AI_USE_CASE } from '../ai-intelligence/ai-audit.constants';
import { AiAgentRunsRepository } from '../ai-intelligence/ai-agent-runs.repository';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { AiLlmClient } from '../ai-intelligence/ai-llm.client';
import {
  assertNoInventedMoney,
  buildKitLlmSystemPrompt,
  stripInventedMoney,
} from './intake-sales-kit-llm.util';
import { SalesKitRuntimeService } from './sales-kit-runtime.service';
import type { SalesKitCitation, SalesKitRulesOutput } from './intake-sales-kit-rules.util';

const LLM_WORDING_INTENTS = new Set(['summary_30s', 'next_question', 'freeform', 'ask_library']);

export type IntakeSalesKitLlmUseCase =
  | typeof AI_USE_CASE.INTAKE_SALES_KIT
  | typeof AI_USE_CASE.INTAKE_AI_SUMMARY;

export type IntakeSalesKitLlmInput = {
  intent: string;
  rules: SalesKitRulesOutput;
  citations: Array<Pick<SalesKitCitation, 'excerpt' | 'kind'>>;
  industry?: string | null;
  service_slug: string;
  session_id?: number;
  useCase?: IntakeSalesKitLlmUseCase;
};

@Injectable()
export class IntakeSalesKitLlmService {
  private readonly logger = new Logger(IntakeSalesKitLlmService.name);

  constructor(
    private readonly llm: AiLlmClient,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly agentRuns: AiAgentRunsRepository,
    private readonly runtime: SalesKitRuntimeService,
  ) {}

  async polish(input: IntakeSalesKitLlmInput): Promise<SalesKitRulesOutput> {
    const rules = { ...input.rules, apply: { ...input.rules.apply } };
    const citations = input.citations ?? rules.citations ?? [];

    if (!(await this.shouldCallLlm(input.intent, citations))) {
      return { ...rules, stub_mode: true };
    }

    const started = Date.now();
    const useCase = input.useCase ?? AI_USE_CASE.INTAKE_SALES_KIT;
    const systemPrompt = buildKitLlmSystemPrompt();
    const userContent = JSON.stringify({
      intent: input.intent,
      rules_reply: rules.reply_vi,
      citations: citations.map((c) => ({ excerpt: c.excerpt, kind: c.kind })),
      industry: input.industry ?? '',
      service_slug: input.service_slug,
    });
    const promptHash = createHash('sha256')
      .update(`${systemPrompt}\n---\n${userContent}`)
      .digest('hex')
      .slice(0, 16);

    try {
      await this.runtime.loadDbMode();
      const mode = this.runtime.resolveMode();
      const callOpts = this.runtime.llmCallOptions(mode);
      const model = callOpts?.model ?? this.aiConfig.llmModel;

      const { parsed, tokenUsage, modelName, stubMode } = await this.llm.completeJson({
        systemPrompt,
        userContent,
        model,
        apiKey: callOpts?.apiKey,
        baseUrl: callOpts?.baseUrl,
        timeoutMs: callOpts?.timeoutMs,
        stubJson: () => ({ reply_vi: rules.reply_vi }),
      });

      const merged = this.mergeWording(rules, parsed, input.intent, citations);
      await this.audit({
        useCase,
        status: 'succeeded',
        modelName,
        promptHash,
        input: { intent: input.intent, session_id: input.session_id ?? null },
        output: { stub_mode: stubMode },
        tokenUsage,
        latencyMs: Date.now() - started,
      });
      return { ...merged, stub_mode: stubMode };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Intake sales kit LLM failed intent=${input.intent}: ${message}`);
      const errorCode =
        err instanceof ServiceUnavailableException
          ? AI_AUDIT_ERROR.LLM_TIMEOUT
          : AI_AUDIT_ERROR.LLM_PROVIDER_ERROR;
      await this.audit({
        useCase,
        status: 'failed',
        modelName: this.aiConfig.llmModel,
        promptHash,
        input: { intent: input.intent, session_id: input.session_id ?? null },
        output: {},
        latencyMs: Date.now() - started,
        errorMessage: message,
        errorCode,
      });
      return { ...rules, stub_mode: true };
    }
  }

  private async shouldCallLlm(
    intent: string,
    citations: Array<Pick<SalesKitCitation, 'kind'>>,
  ): Promise<boolean> {
    await this.runtime.loadDbMode();
    const mode = this.runtime.resolveMode();
    if (mode === 'off') return false;
    const opts = this.runtime.llmCallOptions(mode);
    if (!opts?.apiKey) return false;
    if (!LLM_WORDING_INTENTS.has(intent)) return false;
    if (intent === 'ask_library' && citations.length === 0) return false;
    return true;
  }

  private mergeWording(
    rules: SalesKitRulesOutput,
    parsed: Record<string, unknown>,
    intent: string,
    citations: Array<Pick<SalesKitCitation, 'kind'>>,
  ): SalesKitRulesOutput {
    let reply = typeof parsed.reply_vi === 'string' ? parsed.reply_vi : rules.reply_vi;
    if (!assertNoInventedMoney(reply, citations)) {
      const stripped = stripInventedMoney(reply);
      reply = stripped || rules.reply_vi;
    }

    const apply = { ...rules.apply };
    if (intent === 'summary_30s' || apply.ai_summary) {
      apply.ai_summary = reply;
    }

    const parsedApply =
      parsed.apply && typeof parsed.apply === 'object'
        ? (parsed.apply as Record<string, unknown>)
        : {};
    const hints = parsed.bant_hints ?? parsedApply.bant_hints;
    if (hints && typeof hints === 'object' && !Array.isArray(hints)) {
      apply.bant_hints = hints as NonNullable<SalesKitRulesOutput['apply']['bant_hints']>;
    }

    const next = rules.next_question
      ? { ...rules.next_question }
      : undefined;
    if (next) {
      const fromParsed =
        (typeof parsed.next_question_text === 'string' && parsed.next_question_text) ||
        (parsed.next_question &&
        typeof parsed.next_question === 'object' &&
        typeof (parsed.next_question as { text?: unknown }).text === 'string'
          ? String((parsed.next_question as { text: string }).text)
          : '');
      if (fromParsed) {
        let nextText = fromParsed;
        if (!assertNoInventedMoney(nextText, citations)) {
          const stripped = stripInventedMoney(nextText);
          nextText = stripped || rules.next_question!.text;
        }
        next.text = nextText;
      }
    }

    return {
      ...rules,
      reply_vi: reply,
      apply,
      ...(next ? { next_question: next } : {}),
    };
  }

  private async audit(row: {
    useCase: string;
    status: 'succeeded' | 'failed';
    modelName: string;
    promptHash: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    tokenUsage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    latencyMs: number;
    errorMessage?: string;
    errorCode?: string;
  }): Promise<void> {
    try {
      if (!(await this.agentRuns.tableReady())) return;
      await this.agentRuns.insertRun({
        agentName: 'intake-sales-kit',
        useCase: row.useCase,
        modelName: row.modelName,
        promptHash: row.promptHash,
        inputJson: row.input,
        outputJson: row.output,
        status: row.status,
        latencyMs: row.latencyMs,
        tokenUsage: row.tokenUsage,
        errorMessage: row.errorMessage,
        errorCode: row.errorCode,
      });
    } catch (auditErr) {
      this.logger.warn(`Intake sales kit audit persist failed: ${String(auditErr)}`);
    }
  }
}
