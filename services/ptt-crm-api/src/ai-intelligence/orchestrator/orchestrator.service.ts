import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiAgentRunsRepository } from '../ai-agent-runs.repository';
import { AI_USE_CASE } from '../ai-audit.constants';
import { AiAuditService } from '../ai-audit.service';
import { AiIntelligenceConfigService } from '../ai-intelligence.config';
import { AiApiEnvelope } from '../ai-intelligence.types';
import {
  OrchestratorEngine,
  OrchestratorRequiredStepError,
} from './orchestrator.engine';
import { OrchestratorRepository } from './orchestrator.repository';
import {
  AiOrchestrationTree,
  OrchestratorListResult,
  OrchestratorRunData,
  OrchestratorRunRequest,
} from './orchestrator.types';

export type OrchestratorRunResponse = AiApiEnvelope<OrchestratorRunData>;
export type OrchestratorDetailResponse = AiApiEnvelope<AiOrchestrationTree>;
export type OrchestratorListResponse = AiApiEnvelope<
  OrchestratorListResult & { limit: number; offset: number }
>;

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly config: AiIntelligenceConfigService,
    private readonly repository: OrchestratorRepository,
    private readonly runs: AiAgentRunsRepository,
    private readonly engine: OrchestratorEngine,
    private readonly audit: AiAuditService,
  ) {}

  isEnabled(): boolean {
    return this.config.orchestratorEnabled;
  }

  async run(request: OrchestratorRunRequest): Promise<OrchestratorRunResponse> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException({
        error: 'orchestrator_disabled',
        message: 'PTT_AI_ORCHESTRATOR_ENABLED is off',
      });
    }

    const planKey = String(request.planKey ?? '').trim();
    this.engine.resolvePlan(planKey);
    const entityType = String(request.input?.entityType ?? '').trim();
    const entityId = String(request.input?.entityId ?? '').trim();
    if (!entityType || !entityId) {
      throw new BadRequestException({
        error: 'orchestrator_entity_required',
        message: 'input.entityType and input.entityId are required',
      });
    }
    await this.assertReady();

    const requestId = request.correlationId?.trim() || this.audit.newRequestId();
    const actorId = request.actorId ?? null;
    const clientId = request.clientId?.trim() || null;
    const input = {
      ...request.input,
      entityType,
      entityId,
      clientId,
      actorId,
      correlationId: requestId,
    };
    const started = Date.now();
    const orchestration = await this.repository.create({
      clientId,
      triggerType: 'manual',
      planKey,
      status: 'running',
      inputJson: input,
      correlationId: requestId,
      actorId,
    });
    const parentRun = await this.runs.insertRun({
      agentName: 'orchestrator',
      useCase: AI_USE_CASE.ORCHESTRATION_RUN,
      clientId,
      status: 'running',
      orchestrationId: orchestration.id,
      inputJson: {
        plan_key: planKey,
        entity_type: entityType,
        entity_id: entityId,
      },
      correlationId: requestId,
      actorId,
    });

    try {
      const steps = await this.engine.runPlan(planKey, {
        orchestrationId: orchestration.id,
        parentRunId: parentRun.id,
        planKey,
        input,
        actorId,
        correlationId: requestId,
        clientId,
      });
      const output = {
        completed_steps: steps.filter((step) => step.status === 'succeeded').length,
        failed_optional_steps: steps.filter((step) => step.status === 'failed').length,
        skipped_steps: steps.filter((step) => step.status === 'skipped').length,
        steps,
      };
      await this.runs.updateRun(parentRun.id, {
        status: 'succeeded',
        outputJson: output,
        latencyMs: Date.now() - started,
      });
      await this.repository.updateStatus(orchestration.id, 'succeeded', output);

      return {
        data: {
          orchestration_id: orchestration.id,
          parent_run_id: parentRun.id,
          plan_key: planKey,
          status: 'succeeded',
          steps,
        },
        meta: { request_id: requestId },
        errors: [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedStep =
        error instanceof OrchestratorRequiredStepError ? error.failedStep : 'orchestrator';
      const output = {
        failed_step: failedStep,
        error: message,
        steps: error instanceof OrchestratorRequiredStepError ? error.steps : [],
      };
      await Promise.allSettled([
        this.runs.updateRun(parentRun.id, {
          status: 'failed',
          outputJson: output,
          errorMessage: message,
          latencyMs: Date.now() - started,
        }),
        this.repository.updateStatus(orchestration.id, 'failed', output),
      ]);
      throw error;
    }
  }

  async get(id: string, correlationId?: string): Promise<OrchestratorDetailResponse> {
    await this.assertReady();
    const orchestration = await this.repository.getOrchestration(id);
    if (!orchestration) {
      throw new NotFoundException({ error: 'orchestration_not_found', id });
    }
    const allRuns = await this.runs.listByOrchestration(id);
    const parentRun =
      allRuns.find((run) => run.parent_run_id === null && run.agent_name === 'orchestrator') ??
      null;
    const children = parentRun
      ? allRuns.filter((run) => run.parent_run_id === parentRun.id)
      : [];

    return {
      data: { orchestration, parentRun, children },
      meta: { request_id: correlationId?.trim() || this.audit.newRequestId() },
      errors: [],
    };
  }

  async list(
    limitInput?: number,
    offsetInput?: number,
    correlationId?: string,
  ): Promise<OrchestratorListResponse> {
    await this.assertReady();
    const limit = Math.min(Math.max(Number(limitInput) || 50, 1), 200);
    const offset = Math.max(Number(offsetInput) || 0, 0);
    const result = await this.repository.list(limit, offset);
    return {
      data: { ...result, limit, offset },
      meta: { request_id: correlationId?.trim() || this.audit.newRequestId() },
      errors: [],
    };
  }

  private async assertReady(): Promise<void> {
    await this.audit.assertAuditReady();
    if (!(await this.repository.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'orchestrator_schema_not_ready',
        message: 'Apply RNOS-31 orchestrator migration',
      });
    }
  }
}
