import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { LeadActivityRow } from '../crm-leads-legacy/crm-leads-legacy.types';
import { LeadV1 } from '../leads/leads.types';
import {
  TIMELINE_ENTITY,
  TIMELINE_EVENT,
  TimelineEventSource,
} from './customer-timeline.constants';
import { CustomerTimelineRepository } from './customer-timeline.repository';
import {
  AiTimelineContextItem,
  CustomerTimelineApiEnvelope,
  CustomerTimelineEvent,
  CustomerTimelineListQuery,
  TimelineCompletenessReport,
} from './customer-timeline.types';

function channelToEventSource(channel: string | null | undefined): TimelineEventSource {
  const ch = String(channel ?? '')
    .trim()
    .toLowerCase();
  if (ch === 'meta' || ch === 'facebook') return 'meta';
  if (ch === 'zalo') return 'zalo';
  if (ch === 'email') return 'email';
  if (ch === 'seo') return 'seo';
  return 'crm';
}

function activitySource(activityType: string): TimelineEventSource {
  if (activityType === 'call') return 'call';
  if (activityType === 'system') return 'system';
  return 'crm';
}

@Injectable()
export class CustomerTimelineService {
  private readonly logger = new Logger(CustomerTimelineService.name);

  constructor(private readonly repo: CustomerTimelineRepository) {}

  newRequestId(): string {
    return randomUUID();
  }

  async isReady(): Promise<boolean> {
    return this.repo.tableReady();
  }

  async getTimelineEnvelope(
    entityType: string,
    entityId: string,
    query: Omit<CustomerTimelineListQuery, 'entityType' | 'entityId'>,
    requestId?: string,
  ): Promise<
    CustomerTimelineApiEnvelope<{
      entity_type: string;
      entity_id: string;
      events: CustomerTimelineEvent[];
      total: number;
      limit: number;
      offset: number;
    }>
  > {
    await this.assertReady();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const result = await this.repo.listEvents({
      entityType,
      entityId,
      eventSource: query.eventSource,
      limit,
      offset,
    });
    return {
      data: {
        entity_type: entityType,
        entity_id: entityId,
        events: result.rows,
        total: result.total,
        limit,
        offset,
      },
      meta: { request_id: requestId ?? this.newRequestId() },
      errors: [],
    };
  }

  async buildAiContext(
    entityType: string,
    entityId: string,
    limit = 20,
  ): Promise<AiTimelineContextItem[]> {
    if (!(await this.repo.tableReady())) {
      return [];
    }
    const result = await this.repo.listEvents({ entityType, entityId, limit });
    return result.rows.map((row) => ({
      event_type: row.event_type,
      event_source: row.event_source,
      title: row.title,
      summary: this.summarizeBody(row.body, row.payload),
      occurred_at: row.occurred_at,
      payload_keys: Object.keys(row.payload ?? {}),
    }));
  }

  async completenessReport(sampleLimit = 500): Promise<TimelineCompletenessReport> {
    await this.assertReady();
    return this.repo.completenessReport(sampleLimit);
  }

  /** Mirror CRM activity → timeline (RNOS-16). */
  async recordActivityFromLegacy(
    leadId: number,
    activity: LeadActivityRow,
    clientId?: string | null,
  ): Promise<CustomerTimelineEvent | null> {
    if (!(await this.repo.tableReady())) {
      return null;
    }
    const resolvedClientId = clientId ?? (await this.resolveClientId(leadId));
    const activityType = String(activity.activity_type ?? 'note');
    const externalRef = `activity:${leadId}:${activity.id}`;

    try {
      const existing = await this.repo.findByExternalRef(externalRef);
      if (existing) return existing;

      return await this.repo.insertEvent({
        clientId: resolvedClientId,
        entityType: TIMELINE_ENTITY.LEAD,
        entityId: String(leadId),
        eventType: TIMELINE_EVENT.ACTIVITY,
        eventSource: activitySource(activityType),
        title: activity.activity_type_label || activityType,
        body: [activity.content, activity.result].filter(Boolean).join('\n').slice(0, 4000) || null,
        payload: {
          entity_type: TIMELINE_ENTITY.LEAD,
          entity_id: String(leadId),
          activity_id: activity.id,
          activity_type: activityType,
          next_action: activity.next_action || null,
        },
        occurredAt: activity.created_at,
        actorId: activity.created_by || null,
        externalRef,
      });
    } catch (err) {
      this.logMirrorError('recordActivityFromLegacy', err);
      return null;
    }
  }

  async recordStatusChange(input: {
    leadId: number;
    from: string | null | undefined;
    to: string;
    actorId?: string | null;
    note?: string;
    clientId?: string | null;
    occurredAt?: string;
  }): Promise<CustomerTimelineEvent | null> {
    if (!(await this.repo.tableReady())) {
      return null;
    }
    const resolvedClientId = input.clientId ?? (await this.resolveClientId(input.leadId));
    const externalRef = `status:${input.leadId}:${input.from ?? 'null'}:${input.to}:${input.occurredAt ?? ''}`;

    try {
      return await this.repo.insertEvent({
        clientId: resolvedClientId,
        entityType: TIMELINE_ENTITY.LEAD,
        entityId: String(input.leadId),
        eventType: TIMELINE_EVENT.STATUS_CHANGED,
        eventSource: 'crm',
        title: `Trạng thái: ${input.from ?? '?'} → ${input.to}`,
        body: input.note?.slice(0, 2000) || null,
        payload: {
          entity_type: TIMELINE_ENTITY.LEAD,
          entity_id: String(input.leadId),
          from_status: input.from ?? null,
          to_status: input.to,
        },
        occurredAt: input.occurredAt,
        actorId: input.actorId ?? null,
        externalRef,
      });
    } catch (err) {
      this.logMirrorError('recordStatusChange', err);
      return null;
    }
  }

  async recordLeadIngested(input: {
    leadId: number;
    channel?: string | null;
    clientId?: string | null;
    source?: string | null;
    externalLeadId?: string | null;
    campaignId?: string | null;
    attribution?: Record<string, unknown>;
    correlationId?: string | null;
    occurredAt?: string;
  }): Promise<CustomerTimelineEvent | null> {
    if (!(await this.repo.tableReady())) {
      return null;
    }
    const eventSource = channelToEventSource(input.channel);
    const ext = String(input.externalLeadId ?? '').trim();
    const externalRef =
      ext && input.channel
        ? `ingest:${String(input.channel).toLowerCase()}:${ext}`
        : `ingest:lead:${input.leadId}`;

    try {
      const existing = await this.repo.findByExternalRef(externalRef);
      if (existing) return existing;

      return await this.repo.insertEvent({
        clientId: input.clientId ?? (await this.resolveClientId(input.leadId)),
        entityType: TIMELINE_ENTITY.LEAD,
        entityId: String(input.leadId),
        eventType: TIMELINE_EVENT.LEAD_INGESTED,
        eventSource,
        title: `Lead ingest (${input.channel ?? 'unknown'})`,
        body: null,
        payload: {
          entity_type: TIMELINE_ENTITY.LEAD,
          entity_id: String(input.leadId),
          channel: input.channel ?? null,
          source: input.source ?? null,
          external_lead_id: input.externalLeadId ?? null,
          campaign_id: input.campaignId ?? null,
          correlation_id: input.correlationId ?? null,
          attribution: input.attribution ?? {},
        },
        occurredAt: input.occurredAt,
        actorId: 'system',
        externalRef,
      });
    } catch (err) {
      this.logMirrorError('recordLeadIngested', err);
      return null;
    }
  }

  async recordLeadCreatedFromV1(lead: LeadV1, correlationId?: string | null): Promise<void> {
    await this.recordLeadIngested({
      leadId: lead.id,
      channel: lead.channel,
      clientId: lead.client_id,
      source: lead.source,
      externalLeadId: lead.external_lead_id,
      campaignId: lead.campaign_id,
      correlationId,
      occurredAt: lead.received_at || lead.created_at,
      attribution: {
        channel: lead.channel,
        source: lead.source,
        campaign_id: lead.campaign_id,
      },
    });
  }

  private async resolveClientId(leadId: number): Promise<string | null> {
    return this.repo.getLeadClientId(leadId);
  }

  private summarizeBody(body: string | null, payload: Record<string, unknown>): string | null {
    if (body?.trim()) {
      return body.trim().slice(0, 280);
    }
    const parts: string[] = [];
    if (payload.from_status && payload.to_status) {
      parts.push(`${payload.from_status} → ${payload.to_status}`);
    }
    if (payload.channel) {
      parts.push(`channel=${String(payload.channel)}`);
    }
    if (payload.activity_type) {
      parts.push(`activity=${String(payload.activity_type)}`);
    }
    return parts.length ? parts.join(' · ') : null;
  }

  private async assertReady(): Promise<void> {
    if (!(await this.repo.tableReady())) {
      throw new Error('customer_timeline_events not ready — apply RNOS-01 DDL');
    }
  }

  private logMirrorError(op: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`Timeline mirror ${op} failed: ${message}`);
  }
}
