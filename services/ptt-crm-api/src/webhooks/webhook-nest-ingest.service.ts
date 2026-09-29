import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { LeadsWriteService } from '../leads/leads-write.service';
import { JobQueueRepository, type EnqueueIngestResult } from './job-queue.repository';
import {
  preparedLeadToCreateBody,
  type WebhookIngestLead,
} from './webhook-nest-ingest.util';

export type NestIngestLeadResult = {
  status: 'created' | 'duplicate' | 'failed';
  lead_id?: number;
  owner_id?: number | null;
  message?: string;
};

export type NestIngestBatchResult = {
  mode: 'nest' | 'queue';
  created: number;
  duplicates: number;
  failed: number;
  lead_ids: number[];
  results: NestIngestLeadResult[];
  /** Present when mode=queue (Python worker fallback). */
  jobs?: EnqueueIngestResult['jobs'];
};

@Injectable()
export class WebhookNestIngestService {
  private readonly logger = new Logger(WebhookNestIngestService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly leadsWrite: LeadsWriteService,
    private readonly jobQueue: JobQueueRepository,
  ) {}

  /** Prefer Nest createLead (B2B first-assign). Fall back to Python ingest_lead queue when disabled. */
  async ingestPreparedLeads(
    leads: WebhookIngestLead[],
    opts: { channel: string; correlationId?: string; clientId?: string },
  ): Promise<NestIngestBatchResult> {
    if (!leads.length) {
      return { mode: 'nest', created: 0, duplicates: 0, failed: 0, lead_ids: [], results: [] };
    }

    if (!this.config.webhookNestIngestEnabled) {
      const enqueue = await this.jobQueue.enqueueIngestLeads(leads, opts);
      return {
        mode: 'queue',
        created: enqueue.jobs.filter((j) => j.created).length,
        duplicates: enqueue.jobs.filter((j) => !j.created).length,
        failed: 0,
        lead_ids: [],
        results: [],
        jobs: enqueue.jobs,
      };
    }

    const results: NestIngestLeadResult[] = [];
    const leadIds: number[] = [];
    let created = 0;
    let duplicates = 0;
    let failed = 0;

    for (const lead of leads) {
      const one = await this.ingestOne(lead, opts.correlationId);
      results.push(one);
      if (one.status === 'created') {
        created += 1;
        if (one.lead_id != null) leadIds.push(one.lead_id);
      } else if (one.status === 'duplicate') {
        duplicates += 1;
        if (one.lead_id != null) leadIds.push(one.lead_id);
      } else {
        failed += 1;
      }
    }

    this.logger.log(
      `nest_ingest channel=${opts.channel} created=${created} duplicates=${duplicates} failed=${failed} correlation_id=${opts.correlationId ?? ''}`,
    );

    return {
      mode: 'nest',
      created,
      duplicates,
      failed,
      lead_ids: leadIds,
      results,
    };
  }

  private async ingestOne(
    lead: WebhookIngestLead,
    correlationId?: string,
  ): Promise<NestIngestLeadResult> {
    const body = preparedLeadToCreateBody(lead);
    try {
      const created = await this.leadsWrite.createLead(body);
      return {
        status: 'created',
        lead_id: created.id,
        owner_id: created.owner_id ?? null,
      };
    } catch (err) {
      const conflict = this.asConflict(err);
      if (conflict) {
        return {
          status: 'duplicate',
          lead_id: conflict.leadId,
          message: conflict.message,
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `nest_ingest failed external=${body.external_lead_id} correlation_id=${correlationId ?? ''}: ${message}`,
      );
      return { status: 'failed', message };
    }
  }

  private asConflict(err: unknown): { leadId?: number; message: string } | null {
    if (err instanceof ConflictException) {
      const res = err.getResponse();
      const payload =
        typeof res === 'object' && res != null ? (res as Record<string, unknown>) : {};
      const leadId = Number(payload.lead_id);
      return {
        leadId: Number.isFinite(leadId) && leadId > 0 ? leadId : undefined,
        message: String(payload.message ?? payload.error ?? 'duplicate'),
      };
    }
    if (err instanceof HttpException && err.getStatus() === 409) {
      const res = err.getResponse();
      const payload =
        typeof res === 'object' && res != null ? (res as Record<string, unknown>) : {};
      const leadId = Number(payload.lead_id);
      return {
        leadId: Number.isFinite(leadId) && leadId > 0 ? leadId : undefined,
        message: String(payload.message ?? payload.error ?? 'duplicate'),
      };
    }
    return null;
  }
}
