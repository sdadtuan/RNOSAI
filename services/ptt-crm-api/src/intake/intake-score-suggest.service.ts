import { createHash } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AI_AUDIT_ERROR, AI_USE_CASE } from '../ai-intelligence/ai-audit.constants';
import { AiAgentRunsRepository } from '../ai-intelligence/ai-agent-runs.repository';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { AiLlmClient } from '../ai-intelligence/ai-llm.client';
import { IntakeStaffActor } from './intake-b2b-visibility.service';
import {
  filterScoreSuggestions,
  formCorpus,
  normalizeScoreQuote,
  type ScoreSuggestion,
} from './intake-score-suggest.util';
import { IntakeService } from './intake.service';

export type IntakeScoreSuggestResult = {
  stub_mode: boolean;
  suggestions: {
    bant?: Partial<Record<string, ScoreSuggestion>>;
    win?: Partial<Record<string, ScoreSuggestion>>;
  };
  rejected: Array<{ layer: 'bant' | 'win'; key: string; reason: string }>;
};

const EMPTY_STUB: IntakeScoreSuggestResult = {
  stub_mode: true,
  suggestions: {},
  rejected: [],
};

function collectDiscoveryAnswers(answers: Record<string, unknown> | undefined): string[] {
  const raw = answers?.discovery_responses;
  if (!raw || typeof raw !== 'object') return [];
  const out: string[] = [];
  for (const val of Object.values(raw as Record<string, unknown>)) {
    let text = '';
    if (typeof val === 'string') text = val;
    else if (val && typeof val === 'object') {
      text = String((val as Record<string, unknown>).answer ?? '');
    }
    const trimmed = text.trim();
    if (trimmed) out.push(trimmed);
  }
  return out;
}

function collectWinAnswers(answers: Record<string, unknown> | undefined): string[] {
  const raw = answers?.win_intel;
  if (!raw || typeof raw !== 'object') return [];
  const out: string[] = [];
  for (const val of Object.values(raw as Record<string, unknown>)) {
    let text = '';
    if (typeof val === 'string') text = val;
    else if (val && typeof val === 'object') {
      text = String((val as Record<string, unknown>).answer ?? '');
    }
    const trimmed = text.trim();
    if (trimmed) out.push(trimmed);
  }
  return out;
}

function collectCommitmentTexts(
  rows: Array<Record<string, string>> | undefined,
): string[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => String(row.detail ?? row.text ?? row.commitment ?? '').trim())
    .filter(Boolean);
}

function coerceLayer(raw: unknown): Partial<Record<string, ScoreSuggestion>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Partial<Record<string, ScoreSuggestion>> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue;
    const rec = val as Record<string, unknown>;
    out[key] = {
      score: Number(rec.score) as ScoreSuggestion['score'],
      quote: String(rec.quote ?? ''),
    };
  }
  return out;
}

function buildSystemPrompt(): string {
  return `Bạn chấm BANT và Win từ lời khách trên form Intake.
Quy tắc:
- Chỉ dùng nguyên văn đoạn trong discovery_answers, win_answers, commitments.
- Mỗi key: score 1–5 (số nguyên) và quote substring của các chuỗi đó.
- Không bịa số tiền, KPI, case, hoặc câu khách không có trên form.
- Không chấm key nếu không có quote khớp.
Trả JSON: { "bant": { "<key>": { "score": 1-5, "quote": "..." } }, "win": { ... } }.`;
}

@Injectable()
export class IntakeScoreSuggestService {
  private readonly logger = new Logger(IntakeScoreSuggestService.name);

  constructor(
    private readonly intake: IntakeService,
    private readonly llm: AiLlmClient,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly agentRuns: AiAgentRunsRepository,
  ) {}

  async suggestScores(
    sessionId: number,
    actor?: IntakeStaffActor | null,
  ): Promise<IntakeScoreSuggestResult> {
    if (!this.aiConfig.intakeLlmScoreEnabled) {
      throw new ServiceUnavailableException({ error: 'llm_score_disabled' });
    }

    const session = await this.intake.getSession(sessionId, actor);
    const discoveryAnswers = collectDiscoveryAnswers(session.answers_json);
    const winAnswers = collectWinAnswers(session.answers_json);
    const commitmentTexts = collectCommitmentTexts(session.commitments_json);
    const corpus = formCorpus({ discoveryAnswers, winAnswers, commitmentTexts });

    if (normalizeScoreQuote(corpus).length < 20) {
      return EMPTY_STUB;
    }

    const systemPrompt = buildSystemPrompt();
    const userPayload = { discovery_answers: discoveryAnswers, win_answers: winAnswers, commitments: commitmentTexts };
    const userContent = JSON.stringify(userPayload);
    const promptHash = createHash('sha256')
      .update(`${systemPrompt}\n---\n${userContent}`)
      .digest('hex')
      .slice(0, 16);
    const started = Date.now();
    const timeoutMs = this.aiConfig.intakeSalesKitLlmTimeoutMs || 8000;

    try {
      const { parsed, tokenUsage, modelName, stubMode } = await this.llm.completeJson({
        systemPrompt,
        userContent,
        model: this.aiConfig.llmModel,
        timeoutMs,
        stubJson: () => ({ bant: {}, win: {} }),
      });

      const filtered = filterScoreSuggestions({
        corpus,
        bant: coerceLayer(parsed.bant),
        win: coerceLayer(parsed.win),
      });
      const result: IntakeScoreSuggestResult = {
        stub_mode: stubMode,
        suggestions: filtered.suggestions,
        rejected: filtered.rejected,
      };
      await this.audit({
        status: 'succeeded',
        modelName,
        promptHash,
        input: { session_id: sessionId },
        output: { stub_mode: stubMode, rejected: result.rejected },
        tokenUsage,
        latencyMs: Date.now() - started,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Intake score suggest LLM failed session=${sessionId}: ${message}`);
      const errorCode =
        err instanceof ServiceUnavailableException
          ? AI_AUDIT_ERROR.LLM_TIMEOUT
          : AI_AUDIT_ERROR.LLM_PROVIDER_ERROR;
      await this.audit({
        status: 'failed',
        modelName: this.aiConfig.llmModel,
        promptHash,
        input: { session_id: sessionId },
        output: {},
        latencyMs: Date.now() - started,
        errorMessage: message,
        errorCode,
      });
      return EMPTY_STUB;
    }
  }

  private async audit(row: {
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
        agentName: 'intake-score-suggest',
        useCase: AI_USE_CASE.INTAKE_SCORE_SUGGEST,
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
      this.logger.warn(`Intake score suggest audit persist failed: ${String(auditErr)}`);
    }
  }
}
