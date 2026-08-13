import { Injectable, Logger } from '@nestjs/common';
import { EnqueuedJob, JobQueueRepository } from '../webhooks/job-queue.repository';
import { AppConfigService } from '../config/app-config.service';
import { LeadMeetingPrepInputResolver } from './lead-meeting-prep-input.resolver';
import { LeadMeetingPrepRepository } from './lead-meeting-prep.repository';
import type { EnqueueLeadMeetingPrepInput } from './lead-meeting-prep.types';

/** S-LMP-1 — enqueue lead_meeting_prep after LeadCreated (AI-UC-021). */
@Injectable()
export class LeadMeetingPrepEnqueueService {
  private readonly logger = new Logger(LeadMeetingPrepEnqueueService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly jobQueue: JobQueueRepository,
    private readonly repo: LeadMeetingPrepRepository,
    private readonly inputResolver: LeadMeetingPrepInputResolver,
  ) {}

  isEnabled(): boolean {
    return this.config.leadMeetingPrepEnabled && this.config.jobsEnabled;
  }

  async enqueueAfterLeadCreated(input: EnqueueLeadMeetingPrepInput): Promise<EnqueuedJob | null> {
    if (!this.isEnabled()) return null;

    const leadId = Number(input.leadId);
    if (!Number.isFinite(leadId) || leadId <= 0) return null;

    try {
      if (!(await this.repo.tableReady())) {
        this.logger.warn(`lead_meeting_prep table missing — apply DDL lead=${leadId}`);
        return null;
      }

      const ctx = await this.repo.getLeadContext(leadId);
      if (!ctx) return null;

      const skipReason = this.inputResolver.isEligibleForAutoEnqueue(ctx, {
        pilotClientIds: this.config.lmpPilotClientIds,
      });
      const resolved = this.inputResolver.resolve(ctx);
      const snapshot = {
        input: resolved.input,
        sources_map: resolved.sources_map,
      };

      if (skipReason || resolved.skip_reason) {
        await this.repo.markSkipped(
          leadId,
          skipReason ?? resolved.skip_reason ?? 'skipped',
          snapshot,
        );
        return null;
      }

      const prepStage = input.prepStage ?? 'm1_first_strike';
      await this.repo.upsertPending({
        leadId,
        prepStage,
        inputSnapshot: snapshot,
        selectedEntityId: input.selectedEntityId ?? null,
      });

      const idempotencyKey = input.force
        ? `lead_meeting_prep:lead:${leadId}:manual:${Date.now()}`
        : `lead_meeting_prep:lead:${leadId}`;

      const job = await this.jobQueue.enqueueLeadMeetingPrepJob({
        leadId,
        clientId: input.clientId ?? ctx.client_id,
        correlationId: input.correlationId ?? undefined,
        prepStage,
        mode: input.mode ?? 'full',
        selectedEntityId: input.selectedEntityId ?? null,
        idempotencyKey,
      });

      if (job?.created) {
        this.logger.debug(`lead_meeting_prep enqueued lead=${leadId}`);
      }
      return job;
    } catch (err) {
      this.logger.warn(`lead_meeting_prep enqueue skipped lead=${leadId}: ${String(err)}`);
      return null;
    }
  }
}
