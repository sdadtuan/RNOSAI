import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiScoreAsyncService } from '../ai-intelligence/ai-score-async.service';
import { DomainEventService } from '../events/domain-event.service';
import { CustomerTimelineService } from '../customer-timeline/customer-timeline.service';
import { MetaConversionSideEffectsService } from '../meta-tracking/meta-conversion-side-effects.service';
import { PerformanceService } from '../performance/performance.service';
import { PgLeadsWriteRepository } from './pg-leads-write.repository';
import { CreateLeadV1Body, LeadV1, PatchLeadV1Body } from './leads.types';
import { LeadCreateEnrichmentService } from './ingest/lead-create-enrichment.service';
import {
  LeadStatusGatePatchOptions,
  LeadStatusGateService,
} from './lead-status-gate.service';
import { LeadStatusGateError } from './lead-status-gate.util';

@Injectable()
export class LeadsWriteService {
  constructor(
    private readonly writeRepo: PgLeadsWriteRepository,
    private readonly enrichment: LeadCreateEnrichmentService,
    private readonly events: DomainEventService,
    private readonly timeline: CustomerTimelineService,
    private readonly conversionFx: MetaConversionSideEffectsService,
    private readonly performance: PerformanceService,
    private readonly scoreAsync: AiScoreAsyncService,
    private readonly statusGate: LeadStatusGateService,
  ) {}

  async createLead(body: CreateLeadV1Body): Promise<LeadV1> {
    if (!body.full_name?.trim()) {
      throw new BadRequestException({ error: 'full_name is required' });
    }
    try {
      const enriched = await this.enrichment.enrich(body);
      const lead = await this.writeRepo.createLead(enriched);
      const correlationId = await this.events.emit(
        'LeadCreated',
        'lead',
        String(lead.id),
        {
          lead_id: lead.id,
          channel: body.channel?.trim() || lead.channel || 'staging',
          client_id: body.client_id ?? lead.client_id ?? null,
          external_lead_id: body.external_lead_id ?? lead.external_lead_id ?? null,
          is_duplicate: Boolean(enriched.is_duplicate),
          owner_id: lead.owner_id,
          canonical_event: 'tenant.lead.created',
        },
      );
      await this.timeline.recordLeadCreatedFromV1(lead);
      if (lead.owner_id != null && !enriched.is_duplicate) {
        await this.events.emit('LeadAssigned', 'lead', String(lead.id), {
          lead_id: lead.id,
          owner_id: lead.owner_id,
          assigned_by: 'auto_assign',
        });
      }
      await this.scoreAsync.enqueueAfterLeadCreated({
        leadId: lead.id,
        clientId: body.client_id ?? lead.client_id ?? null,
        correlationId,
      });
      return lead;
    } catch (err) {
      this.rethrowPg(err);
    }
  }

  async patchLead(
    leadId: number,
    body: PatchLeadV1Body,
    actor?: string,
    gateOpts: LeadStatusGatePatchOptions = {},
  ): Promise<LeadV1> {
    if (
      body.owner_id === undefined &&
      body.status === undefined &&
      body.score === undefined
    ) {
      throw new BadRequestException({ error: 'At least one of owner_id, status, score required' });
    }
    try {
      await this.statusGate.assertPatchAllowed(leadId, body, gateOpts);
      const result = await this.writeRepo.patchLead(leadId, body);
      if (!result) {
        throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
      }
      if (result.assigned && body.owner_id != null) {
        await this.events.emit('LeadAssigned', 'lead', String(leadId), {
          lead_id: leadId,
          owner_id: body.owner_id,
          assigned_by: body.assigned_by?.trim() || actor || null,
        });
      }
      if (result.status_changed && body.status !== undefined) {
        await this.conversionFx.enqueueConversionEval({
          leadId,
          clientId: result.lead.client_id,
          oldStatus: result.previous_status ?? null,
          newStatus: body.status,
        });
        await this.performance.refreshZaloHubCpaOnLeadStatusChange({
          channel: result.lead.channel,
          clientId: result.lead.client_id,
          oldStatus: result.previous_status ?? null,
          newStatus: body.status,
          receivedAt: result.lead.received_at,
          createdAt: result.lead.created_at,
        });
        await this.timeline.recordStatusChange({
          leadId,
          from: result.previous_status,
          to: body.status,
          actorId: actor ?? null,
          clientId: result.lead.client_id,
        });
      }
      return result.lead;
    } catch (err) {
      if (err instanceof LeadStatusGateError) {
        throw new BadRequestException({ error: err.code, message: err.message });
      }
      if (err instanceof HttpException) {
        throw err;
      }
      this.rethrowPg(err);
    }
  }

  async bulkAssignLeads(
    body: { lead_ids: number[]; owner_id: number; reason?: string },
    actor?: string,
  ): Promise<{ assigned: number; skipped: number; lead_ids: number[] }> {
    const ownerId = Number(body.owner_id);
    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      throw new BadRequestException({ error: 'invalid_owner_id' });
    }
    const ids = [...new Set((body.lead_ids ?? []).map((id) => Number(id)).filter((id) => id > 0))];
    if (!ids.length) {
      throw new BadRequestException({ error: 'lead_ids_required' });
    }
    if (ids.length > 200) {
      throw new BadRequestException({ error: 'too_many_leads', message: 'Max 200 leads per bulk assign' });
    }

    const assignedIds: number[] = [];
    let skipped = 0;
    const reason = body.reason?.trim() || 'Bulk assign';

    for (const leadId of ids) {
      try {
        await this.patchLead(
          leadId,
          { owner_id: ownerId, assigned_by: actor ?? 'bulk' },
          actor,
        );
        assignedIds.push(leadId);
      } catch {
        skipped += 1;
      }
    }

    return { assigned: assignedIds.length, skipped, lead_ids: assignedIds };
  }

  private rethrowPg(err: unknown): never {
    const message = err instanceof Error ? err.message : String(err);
    if (/connect|ECONNREFUSED|timeout/i.test(message)) {
      throw new ServiceUnavailableException({ error: 'PostgreSQL unavailable', upstream: 'pg' });
    }
    throw err;
  }
}
