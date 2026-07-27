import { Injectable } from '@nestjs/common';

function envFlag(name: string, defaultValue = false): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

@Injectable()
export class AiIntelligenceConfigService {
  readonly copilotEnabled: boolean;
  readonly pilotUserIds: string[];
  readonly llmProvider: string;
  readonly llmModel: string;
  readonly llmTimeoutMs: number;
  readonly logPii: boolean;
  readonly logPrompts: boolean;
  readonly scoreAsync: boolean;
  readonly llmApiKey: string | null;
  readonly summarizeRateLimitPerMin: number;
  readonly summarizeMinTextLength: number;
  readonly leadRoutingEnabled: boolean;

  constructor() {
    this.copilotEnabled = envFlag('PTT_AI_COPILOT_ENABLED', false);
    this.pilotUserIds = (process.env.PTT_AI_PILOT_USER_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.llmProvider = (process.env.PTT_AI_LLM_PROVIDER ?? 'openai').trim();
    this.llmModel = (process.env.PTT_AI_LLM_MODEL ?? 'gpt-4o-mini').trim();
    this.llmTimeoutMs = Math.max(
      1000,
      Number(process.env.PTT_AI_LLM_TIMEOUT_MS ?? 8000) || 8000,
    );
    this.logPii = envFlag('PTT_AI_LOG_PII', false);
    this.logPrompts = envFlag('PTT_AI_LOG_PROMPTS', false);
    this.scoreAsync = envFlag('PTT_AI_SCORE_ASYNC', true);
    this.llmApiKey =
      (process.env.AI_LLM_API_KEY ?? process.env.PTT_AI_LLM_API_KEY ?? '').trim() || null;
    this.summarizeRateLimitPerMin = Math.max(
      1,
      Number(process.env.PTT_AI_SUMMARIZE_RATE_LIMIT_PER_MIN ?? 20) || 20,
    );
    this.summarizeMinTextLength = Math.max(
      10,
      Number(process.env.PTT_AI_SUMMARIZE_MIN_TEXT ?? 50) || 50,
    );
    this.leadRoutingEnabled = envFlag('PTT_AI_LEAD_ROUTING_ENABLED', true);
  }

  isPilotUser(staffId: string | undefined | null): boolean {
    if (!staffId) return false;
    if (this.pilotUserIds.length === 0) return true;
    return this.pilotUserIds.includes(staffId);
  }
}
