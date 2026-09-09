import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  LEAD_PARTY_LOGO_MAX_BYTES,
  isLeadPartyLogoMimeAllowed,
  leadPartyLogoExt,
} from './lead-party.util';
import { AiScoreAsyncService } from '../ai-intelligence/ai-score-async.service';
import { LeadMeetingPrepEnqueueService } from '../lead-meeting-prep/lead-meeting-prep-enqueue.service';
import { DomainEventService } from '../events/domain-event.service';
import { CustomerTimelineService } from '../customer-timeline/customer-timeline.service';
import { MetaConversionSideEffectsService } from '../meta-tracking/meta-conversion-side-effects.service';
import { PerformanceService } from '../performance/performance.service';
import { PgLeadsWriteRepository } from './pg-leads-write.repository';
import { CreateLeadV1Body, LeadV1, PatchLeadV1Body } from './leads.types';
import { LeadCreateEnrichmentService } from './ingest/lead-create-enrichment.service';
import { B2bFirstAssignService } from '../b2b-projects/b2b-first-assign.service';
import { B2bManualReassignService } from '../b2b-projects/b2b-manual-reassign.service';
import { B2bRoutingAbService } from '../b2b-projects/b2b-routing-ab.service';
import { B2bAdsCapiService } from '../b2b-projects/b2b-ads-capi.service';
import {
  LeadStatusGatePatchOptions,
  LeadStatusGateService,
} from './lead-status-gate.service';
import { LeadStatusGateError } from './lead-status-gate.util';
import { LeadsRepository } from './leads.repository';

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
    private readonly meetingPrepEnqueue: LeadMeetingPrepEnqueueService,
    private readonly statusGate: LeadStatusGateService,
    private readonly b2bFirstAssign: B2bFirstAssignService,
    private readonly b2bManualReassign: B2bManualReassignService,
    private readonly b2bRoutingAb: B2bRoutingAbService,
    private readonly b2bAdsCapi: B2bAdsCapiService,
    private readonly leadsRepo: LeadsRepository,
  ) {}

  async createLead(body: CreateLeadV1Body): Promise<LeadV1> {
    if (!body.full_name?.trim()) {
      throw new BadRequestException({ error: 'full_name is required' });
    }
    try {
      const enriched = await this.enrichment.enrich(body);
      const lead = await this.writeRepo.createLead(enriched);
      if (
        enriched.b2b_first_assign &&
        lead.owner_id != null &&
        !enriched.is_duplicate
      ) {
        await this.b2bFirstAssign.recordFirstAssignHop({
          leadId: lead.id,
          projectId: enriched.b2b_first_assign.projectId,
          toOwnerId: Number(lead.owner_id),
          assign: {
            ownerId: Number(lead.owner_id),
            strategy: enriched.b2b_first_assign.strategy as 'ai_analytics' | 'hybrid' | 'hybrid_timeout',
            reason: enriched.b2b_first_assign.reason,
            confidence: enriched.b2b_first_assign.confidence,
          },
        });
      }
      if (enriched.b2b_project_id && !enriched.is_duplicate) {
        const scoreRaw = enriched.meta?.lead_score;
        const score =
          typeof scoreRaw === 'number'
            ? scoreRaw
            : typeof scoreRaw === 'string' && scoreRaw.trim()
              ? Number(scoreRaw)
              : null;
        await this.b2bFirstAssign.notifyLeadArrival({
          leadId: lead.id,
          projectId: enriched.b2b_project_id,
          ownerId: lead.owner_id != null ? Number(lead.owner_id) : null,
          score: Number.isFinite(score) ? score : null,
        });
      }
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
      if (!enriched.is_duplicate) {
        await this.meetingPrepEnqueue.enqueueAfterLeadCreated({
          leadId: lead.id,
          clientId: body.client_id ?? lead.client_id ?? null,
          correlationId,
        });
      }
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
      body.score === undefined &&
      body.expected_value === undefined &&
      body.margin_pct === undefined &&
      body.company_name === undefined &&
      body.company_address === undefined &&
      body.phone === undefined &&
      body.email === undefined &&
      body.logo_asset_id === undefined
    ) {
      throw new BadRequestException({ error: 'At least one patch field required' });
    }
    try {
      await this.statusGate.assertPatchAllowed(leadId, body, gateOpts);
      const existing = await this.leadsRepo.getLeadById(leadId);
      if (!existing) {
        throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
      }

      const ownerChanging =
        body.owner_id !== undefined &&
        body.owner_id != null &&
        Number(body.owner_id) !== Number(existing.owner_id ?? 0);
      const b2bManual =
        ownerChanging && this.b2bManualReassign.requiresSplitChoice(existing);

      if (b2bManual) {
        if (!body.split) {
          throw new BadRequestException({ error: 'split_required' });
        }
        await this.b2bManualReassign.applyManualOwnerChange({
          leadId,
          projectId: String(existing.b2b_project_id),
          fromOwnerId: existing.owner_id != null ? Number(existing.owner_id) : null,
          toOwnerId: Number(body.owner_id),
          split: body.split,
          reason: body.assigned_by?.trim() || actor || 'manual_reassign',
        });
      }

      const patchBody = b2bManual
        ? {
            ...body,
            owner_id: undefined,
            split: undefined,
          }
        : body;
      const hasPatchFields =
        patchBody.owner_id !== undefined ||
        patchBody.status !== undefined ||
        patchBody.score !== undefined ||
        patchBody.expected_value !== undefined ||
        patchBody.margin_pct !== undefined ||
        patchBody.company_name !== undefined ||
        patchBody.company_address !== undefined ||
        patchBody.phone !== undefined ||
        patchBody.email !== undefined ||
        patchBody.logo_asset_id !== undefined;

      let result;
      if (hasPatchFields) {
        result = await this.writeRepo.patchLead(leadId, patchBody);
      } else if (b2bManual) {
        result = {
          lead: (await this.leadsRepo.getLeadById(leadId))!,
          assigned: true,
          scored: false,
          status_changed: false,
          previous_status: existing.status?.trim() || null,
        };
      } else {
        throw new BadRequestException({ error: 'At least one patch field required' });
      }

      if (!result) {
        throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
      }
      if ((result.assigned || b2bManual) && body.owner_id != null) {
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
        await this.b2bRoutingAb.recordStatusOutcome({
          leadId,
          status: body.status,
        });
        void this.b2bAdsCapi.recordStatusOutcome({
          leadId,
          status: body.status,
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

  async uploadPartyLogo(
    leadId: number,
    file: { buffer?: Buffer; mimetype?: string; size?: number } | undefined,
  ): Promise<LeadV1> {
    const existing = await this.leadsRepo.getLeadById(leadId);
    if (!existing) throw new NotFoundException({ error: 'Not found' });
    if (!file?.buffer?.length) {
      throw new BadRequestException({ error: 'logo_required', message: 'Chọn file logo PNG/JPEG/WebP.' });
    }
    const mime = String(file.mimetype ?? '');
    if (!isLeadPartyLogoMimeAllowed(mime)) {
      throw new BadRequestException({
        error: 'logo_mime',
        message: 'Logo chỉ nhận PNG, JPEG hoặc WebP.',
      });
    }
    if ((file.size ?? file.buffer.length) > LEAD_PARTY_LOGO_MAX_BYTES) {
      throw new BadRequestException({ error: 'logo_too_large', message: 'Logo tối đa 2 MB.' });
    }
    const ext = leadPartyLogoExt(mime);
    if (!ext) {
      throw new BadRequestException({ error: 'logo_mime', message: 'Logo chỉ nhận PNG, JPEG hoặc WebP.' });
    }
    const assetId = `${randomUUID()}.${ext}`;
    const dir = this.logoDir();
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, assetId), file.buffer);
    if (existing.logo_asset_id) {
      await unlink(join(dir, existing.logo_asset_id)).catch(() => undefined);
    }
    const result = await this.writeRepo.patchLead(leadId, { logo_asset_id: assetId });
    if (!result) throw new NotFoundException({ error: 'Not found' });
    return result.lead;
  }

  async deletePartyLogo(leadId: number): Promise<LeadV1> {
    const existing = await this.leadsRepo.getLeadById(leadId);
    if (!existing) throw new NotFoundException({ error: 'Not found' });
    if (existing.logo_asset_id) {
      await unlink(join(this.logoDir(), existing.logo_asset_id)).catch(() => undefined);
    }
    const result = await this.writeRepo.patchLead(leadId, { logo_asset_id: null });
    if (!result) throw new NotFoundException({ error: 'Not found' });
    return result.lead;
  }

  async readPartyLogo(leadId: number): Promise<{ buffer: Buffer; mime: string; etag: string }> {
    const existing = await this.leadsRepo.getLeadById(leadId);
    const assetId = String(existing?.logo_asset_id ?? '').trim();
    if (!existing || !assetId) throw new NotFoundException({ error: 'logo_not_found' });
    const buffer = await readFile(join(this.logoDir(), assetId)).catch(() => null);
    if (!buffer) throw new NotFoundException({ error: 'logo_not_found' });
    const mime =
      assetId.endsWith('.png') ? 'image/png' : assetId.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    const etag = createHash('sha1').update(buffer).digest('hex');
    return { buffer, mime, etag };
  }

  private logoDir(): string {
    return process.env.PTT_LEAD_PARTY_LOGO_DIR?.trim() || join(tmpdir(), 'ptt-lead-party-logos');
  }

  private rethrowPg(err: unknown): never {
    const message = err instanceof Error ? err.message : String(err);
    if (/connect|ECONNREFUSED|timeout/i.test(message)) {
      throw new ServiceUnavailableException({ error: 'PostgreSQL unavailable', upstream: 'pg' });
    }
    throw err;
  }
}
