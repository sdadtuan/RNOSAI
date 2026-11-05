import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiIntelligenceConfigService } from '../ai-intelligence.config';
import { AiToolKeysRepository } from './ai-tool-keys.repository';
import {
  AiToolApiKeyCreateResult,
  AiToolApiKeyRecord,
  AiToolApiKeyScope,
  AiToolDescriptor,
  OPS_AI_TOOL_DENYLIST,
} from './ai-tools.types';
import { ToolRegistry } from './tool.registry';

const DENIED = new Set<string>(OPS_AI_TOOL_DENYLIST);

export interface AiToolCallParams {
  toolName: string;
  input?: Record<string, unknown>;
  apiKey?: AiToolApiKeyScope;
  actorId?: string | null;
  correlationId?: string | null;
  humanApproved?: boolean;
}

export interface CreateAiToolKeyParams {
  name: string;
  allowedTools: string[];
  clientId?: string | null;
  createdBy?: string | null;
}

function isPoolBusy(error: unknown): boolean {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  return code === '53300' || /too many clients/i.test(message);
}

@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(
    private readonly config: AiIntelligenceConfigService,
    private readonly registry: ToolRegistry,
    private readonly keys: AiToolKeysRepository,
  ) {}

  list(): AiToolDescriptor[] {
    this.assertEnabled();
    return this.registry.list();
  }

  async call(params: AiToolCallParams): Promise<unknown> {
    this.assertEnabled();
    const startedAt = Date.now();
    try {
      return await this.dispatch(params, startedAt);
    } catch (error) {
      if (this.isExportDryRun(params) && isPoolBusy(error)) {
        this.logger.error(
          'marketing_plan.export_growth_docx dry_run hit postgres pool limit, retrying once',
          error instanceof Error ? error.stack : String(error),
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        try {
          return await this.dispatch(params, startedAt);
        } catch (retryError) {
          throw await this.settleFailure(params, retryError, startedAt);
        }
      }
      throw await this.settleFailure(params, error, startedAt);
    }
  }

  private async dispatch(params: AiToolCallParams, startedAt: number): Promise<unknown> {
    const toolName = String(params.toolName ?? '').trim();
    const input = params.input ?? {};
    const apiKey = params.apiKey ?? this.staffScope();
    const callResult = await this.registry.callWithMetadata(toolName, input, {
      apiKey,
      actorId: params.actorId,
      correlationId: params.correlationId,
      humanApproved: params.humanApproved,
    });
    await this.recordQuietly({
      apiKeyId: params.apiKey?.id ?? null,
      toolName,
      inputJson: input,
      outputJson: this.asJsonObject(callResult.data),
      status: 'succeeded',
      latencyMs: Date.now() - startedAt,
      agentRunId: callResult.runId,
    });
    return callResult.data;
  }

  private async settleFailure(params: AiToolCallParams, error: unknown, startedAt: number): Promise<never> {
    const toolName = String(params.toolName ?? '').trim();
    const message = error instanceof Error ? error.message : 'tool_call_failed';
    this.logger.error(`ai tool ${toolName} failed`, error instanceof Error ? error.stack : message);
    await this.recordQuietly({
      apiKeyId: params.apiKey?.id ?? null,
      toolName,
      inputJson: params.input ?? {},
      outputJson: { error: message },
      status: 'failed',
      latencyMs: Date.now() - startedAt,
    });
    if (error instanceof HttpException) throw error;
    if (toolName === 'marketing_plan.export_growth_docx') {
      throw new InternalServerErrorException({
        error: 'export_build_failed',
        message,
      });
    }
    throw error;
  }

  private async recordQuietly(entry: Parameters<AiToolKeysRepository['recordCall']>[0]): Promise<void> {
    try {
      await this.keys.recordCall(entry);
    } catch (error) {
      this.logger.error('ai tool call log failed', error instanceof Error ? error.stack : String(error));
    }
  }

  private isExportDryRun(params: AiToolCallParams): boolean {
    if (String(params.toolName ?? '').trim() !== 'marketing_plan.export_growth_docx') return false;
    const persist = params.input?.persist;
    return persist !== true && persist !== 'true' && persist !== 1 && persist !== '1';
  }

  createKey(params: CreateAiToolKeyParams): Promise<AiToolApiKeyCreateResult> {
    const name = String(params.name ?? '').trim();
    const allowedTools = [...new Set(params.allowedTools ?? [])];
    const knownTools = new Set(this.registry.list().map((tool) => tool.name));
    if (!name) {
      throw new BadRequestException({ error: 'key_name_required' });
    }
    if (allowedTools.some((tool) => DENIED.has(tool))) {
      throw new BadRequestException({
        error: 'denied_tools_not_allowed',
        denied: allowedTools.filter((tool) => DENIED.has(tool)),
      });
    }
    if (allowedTools.length === 0 || allowedTools.some((tool) => !knownTools.has(tool))) {
      throw new BadRequestException({ error: 'invalid_allowed_tools' });
    }
    return this.keys.create(
      name,
      allowedTools,
      params.clientId ?? null,
      params.createdBy ?? null,
    );
  }

  listKeys(): Promise<AiToolApiKeyRecord[]> {
    return this.keys.listKeys();
  }

  async revokeKey(id: string): Promise<void> {
    await this.keys.revoke(id);
  }

  private staffScope(): AiToolApiKeyScope {
    return {
      id: 'staff',
      client_id: null,
      allowed_tools: this.registry.list().map((tool) => tool.name),
    };
  }

  private assertEnabled(): void {
    if (!this.config.toolsApiEnabled) {
      throw new ServiceUnavailableException({ error: 'ai_tools_api_disabled' });
    }
  }

  private asJsonObject(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return { result: value };
  }
}
