import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AiIntelligenceConfigService } from '../ai-intelligence/ai-intelligence.config';
import { IntakeStaffActor } from './intake-b2b-visibility.service';
import { SalesKitRuntimeRepository } from './sales-kit-runtime.repository';
import {
  kitRuntimeHint,
  parseSalesKitMode,
  resolveKitMode,
  type SalesKitLlmMode,
  type SalesKitRuntimeDto,
} from './sales-kit-runtime.util';

function hasConfigure(actor: IntakeStaffActor | null | undefined): boolean {
  if (actor === undefined || actor === null) return true;
  return (actor.caps ?? []).some(
    (c) =>
      (c.section === 'playbooks' && c.action === 'configure') ||
      (c.section === 'crm_leads' && c.action === 'configure'),
  );
}

@Injectable()
export class SalesKitRuntimeService {
  private readonly logger = new Logger(SalesKitRuntimeService.name);

  constructor(
    private readonly repo: SalesKitRuntimeRepository,
    private readonly aiConfig: AiIntelligenceConfigService,
  ) {}

  resolveMode(): SalesKitLlmMode {
    const dbRow = this.cachedDbMode;
    return resolveKitMode({
      locked: this.aiConfig.intakeSalesKitModeLocked,
      envMode: this.aiConfig.intakeSalesKitModeEnv,
      legacyOn: this.aiConfig.intakeSalesKitLlmEnabled,
      dbMode: dbRow,
    });
  }

  private cachedDbMode: SalesKitLlmMode | null = null;
  private dbLoaded = false;

  async loadDbMode(): Promise<SalesKitLlmMode | null> {
    if (this.dbLoaded) return this.cachedDbMode;
    const row = await this.repo.getRow();
    this.cachedDbMode = row?.mode ?? null;
    this.dbLoaded = true;
    return this.cachedDbMode;
  }

  async getRuntime(): Promise<SalesKitRuntimeDto> {
    await this.loadDbMode();
    const mode = this.resolveMode();
    const healthy = await this.checkHealthy(mode);
    return {
      mode,
      locked: this.aiConfig.intakeSalesKitModeLocked,
      healthy,
      hint_vi: kitRuntimeHint(mode, healthy),
    };
  }

  async patchMode(
    modeRaw: string,
    actor?: IntakeStaffActor | null,
  ): Promise<SalesKitRuntimeDto & { warning?: string }> {
    if (!hasConfigure(actor)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'playbooks' });
    }
    if (this.aiConfig.intakeSalesKitModeLocked) {
      throw new ForbiddenException({ error: 'mode_locked', message: 'IT đã khóa chế độ trên server.' });
    }
    const mode = parseSalesKitMode(modeRaw);
    if (!mode) {
      throw new ForbiddenException({ error: 'invalid_mode' });
    }
    const staffId = actor && actor.staffId > 0 ? actor.staffId : null;
    await this.repo.setMode(mode, staffId);
    this.cachedDbMode = mode;
    this.dbLoaded = true;
    const healthy = await this.checkHealthy(mode);
    const dto: SalesKitRuntimeDto & { warning?: string } = {
      mode,
      locked: false,
      healthy,
      hint_vi: kitRuntimeHint(mode, healthy),
    };
    if (!healthy && mode !== 'off') {
      dto.warning = dto.hint_vi;
    }
    this.logger.log(`Sales kit mode set to ${mode} by staff=${staffId ?? 'unknown'}`);
    return dto;
  }

  async checkHealthy(mode: SalesKitLlmMode): Promise<boolean> {
    if (mode === 'off') return true;
    if (mode === 'openai') {
      return Boolean(this.aiConfig.intakeSalesKitOpenAiKey);
    }
    const base = this.aiConfig.intakeSalesKitOllamaBaseUrl;
    if (!base) return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(`${base.replace(/\/+$/, '')}/models`, {
        signal: controller.signal,
        headers: this.aiConfig.intakeSalesKitOllamaApiKey
          ? { Authorization: `Bearer ${this.aiConfig.intakeSalesKitOllamaApiKey}` }
          : undefined,
      });
      return response.ok;
    } catch (err) {
      this.logger.debug(`Ollama health check failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  llmCallOptions(mode: SalesKitLlmMode): {
    baseUrl?: string;
    apiKey?: string;
    model: string;
    timeoutMs: number;
  } | null {
    if (mode === 'off') return null;
    if (mode === 'openai') {
      const key = this.aiConfig.intakeSalesKitOpenAiKey;
      if (!key) return null;
      return {
        model: this.aiConfig.intakeSalesKitOpenAiModel,
        apiKey: key,
        timeoutMs: this.aiConfig.intakeSalesKitLlmTimeoutMs,
      };
    }
    const base = this.aiConfig.intakeSalesKitOllamaBaseUrl;
    if (!base) return null;
    return {
      baseUrl: base,
      apiKey: this.aiConfig.intakeSalesKitOllamaApiKey ?? 'ollama',
      model: this.aiConfig.intakeSalesKitOllamaModel,
      timeoutMs: this.aiConfig.intakeSalesKitLlmTimeoutMs,
    };
  }
}
