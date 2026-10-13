import { LeadRow, LeadV1, PgLeadRow } from './leads.types';
import { formatLeadTs } from './lead-ts.format';
import { reviewQueuePublicState } from '../leads-funnel/review-queue.util';
import { resolveLeadFlowKind } from '../leads-funnel/lead-flow-kind.util';
import { isB2bLeadInCall, resolveLeadScoreForBand } from '../b2b-projects/b2b-lead-list.util';
import {
  computeKanbanFirstContactSla,
  computeKanbanPriority,
  defaultKanbanCardSettings,
  isCallbackToday,
  isKanbanStale,
  isQuoteStale,
  kanbanNeedText,
  type KanbanCardSettings,
} from './kanban-card.util';
import { prefillCompanyName } from './lead-party.util';
import type { LeadClassificationConfig } from '../crm-config/lead-classification.types';

export type LeadV1MapperOptions = {
  classification?: LeadClassificationConfig | null;
  kanbanCard?: KanbanCardSettings | null;
};

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function metaString(meta: Record<string, unknown>, key: string): string {
  const val = meta[key];
  if (val === undefined || val === null) {
    return '';
  }
  return String(val);
}

function metaNumber(meta: Record<string, unknown>, key: string): number | null {
  const financial =
    typeof meta.financial === 'object' && meta.financial !== null
      ? (meta.financial as Record<string, unknown>)
      : meta;
  const val = financial[key] ?? meta[key];
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function leadFinancialFields(meta: Record<string, unknown>): Pick<LeadV1, 'expected_value' | 'margin_pct'> {
  return {
    expected_value: metaNumber(meta, 'expected_value'),
    margin_pct: metaNumber(meta, 'margin_pct'),
  };
}

/** Mirror ptt_crm/leads_read.py lead_row_to_v1() — contract frozen Step 2. */
export function leadRowToV1(row: LeadRow): LeadV1 {
  const meta = parseMeta(row.meta_json);
  const channel = String(
    metaString(meta, 'channel') ||
      metaString(meta, 'ingest_channel') ||
      metaString(meta, 'utm_source') ||
      row.source ||
      '',
  );
  const campaignRaw = String(
    metaString(meta, 'campaign_id') ||
      metaString(meta, 'facebook_campaign_id') ||
      metaString(meta, 'zalo_campaign_id') ||
      '',
  );
  const externalRaw = String(
    metaString(meta, 'facebook_leadgen_id') ||
      metaString(meta, 'zalo_lead_id') ||
      metaString(meta, 'external_lead_id') ||
      '',
  );
  const agencyClientId = meta.agency_client_id;
  const receivedAt = String(
    metaString(meta, 'ingested_at') ||
      metaString(meta, 'facebook_created_time') ||
      row.created_at ||
      '',
  );

  return {
    id: Number(row.id),
    full_name: row.full_name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    status: row.status ?? '',
    source: row.source ?? '',
    channel,
    client_id:
      agencyClientId !== undefined && agencyClientId !== null ? String(agencyClientId) : null,
    campaign_id: campaignRaw || null,
    external_lead_id: externalRaw || null,
    owner_id: row.owner_id != null ? Number(row.owner_id) : null,
    created_at: row.created_at ?? '',
    received_at: receivedAt,
    is_duplicate: Boolean(row.is_duplicate),
    ...leadFinancialFields(meta),
    review_queue: reviewQueuePublicState(meta, String(metaString(meta, 'assigned_at') || '')),
    company_name: prefillCompanyName({ column: '', meta, fullName: row.full_name }),
    company_address: metaString(meta, 'company_address'),
    logo_asset_id: metaString(meta, 'logo_asset_id') || null,
  };
}

/** Map PG crm_leads read replica row → LeadV1 (Bước 7). */
export function pgRowToV1(row: PgLeadRow, options?: LeadV1MapperOptions): LeadV1 {
  const meta =
    typeof row.meta_json === 'string'
      ? parseMeta(row.meta_json)
      : typeof row.meta_json === 'object' && row.meta_json !== null
        ? (row.meta_json as Record<string, unknown>)
        : {};
  const assignedAt =
    row.first_assigned_at != null
      ? formatLeadTs(row.first_assigned_at)
      : String(metaString(meta, 'assigned_at') || '');

  const classification = options?.classification ?? null;
  const flowKind = resolveLeadFlowKind({
    clientId: row.agency_client_id,
    channel: row.channel,
    source: row.source,
    status: row.status,
    metaJson: meta,
    routingRules: classification?.routing_rules,
    defaultFlowKind: classification?.default_flow_kind,
  });

  const scoreRaw =
    row.lead_score != null
      ? Number(row.lead_score)
      : metaNumber(meta, 'lead_score');
  const score = resolveLeadScoreForBand({
    score: scoreRaw,
    status: row.status,
    channel: row.channel,
    source: row.source,
    defaultInboundScore: classification?.flows[flowKind]?.default_inbound_score ?? null,
  });
  const assignConfidenceRaw = row.assign_confidence ?? metaNumber(meta, 'assign_confidence');

  const b2bExtras =
    row.b2b_project_id || flowKind === 'b2b_prospect' || score != null
      ? buildB2bListExtras(row, meta, options?.kanbanCard ?? defaultKanbanCardSettings())
      : {};

  return {
    id: Number(row.sqlite_lead_id),
    full_name: row.full_name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    status: row.status ?? '',
    source: row.source ?? '',
    channel: row.channel ?? '',
    client_id: row.agency_client_id ? String(row.agency_client_id) : null,
    campaign_id: row.campaign_id || null,
    external_lead_id: row.external_lead_id || null,
    owner_id: row.owner_id != null ? Number(row.owner_id) : null,
    owner_name: row.owner_name ? String(row.owner_name).trim() || null : null,
    created_at: formatLeadTs(row.created_at),
    received_at: formatLeadTs(row.received_at),
    is_duplicate: Boolean(row.is_duplicate),
    b2b_project_id: row.b2b_project_id ? String(row.b2b_project_id) : null,
    owner_company_id: row.owner_company_id ? String(row.owner_company_id) : null,
    assign_strategy: row.assign_strategy ? String(row.assign_strategy) : null,
    assign_confidence: assignConfidenceRaw,
    lead_flow_kind: flowKind,
    ...b2bExtras,
    ...leadFinancialFields(meta),
    review_queue: reviewQueuePublicState(meta, assignedAt),
    company_name: prefillCompanyName({
      column: row.company_name,
      meta,
      fullName: row.full_name,
    }),
    company_address: String(row.company_address ?? metaString(meta, 'company_address') ?? ''),
    logo_asset_id: row.logo_asset_id ? String(row.logo_asset_id) : metaString(meta, 'logo_asset_id') || null,
  };
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildB2bListExtras(
  row: PgLeadRow,
  meta: Record<string, unknown>,
  settings: KanbanCardSettings,
): Pick<
  LeadV1,
  | 'project_code'
  | 'ai_band'
  | 'sla_state'
  | 'sla_late_minutes'
  | 'column_minutes'
  | 'stale'
  | 'quote_stale'
  | 'callback_today'
  | 'next_call_at'
  | 'in_call'
> {
  const receivedAt = asDate(row.received_at) ?? asDate(row.created_at);
  const status = String(row.status ?? '').trim().toLowerCase();
  const stillNew = status === 'moi' || status === 'new' || status === 'first_contact';
  const columnSince = stillNew ? receivedAt : asDate(row.updated_at) ?? receivedAt;
  const answered = Boolean(row.b2b_call_answered ?? metaString(meta, 'b2b_call_answered') === 'true');
  const hasCall = Boolean(row.b2b_has_call) || Boolean(row.last_call_at) || answered;
  const now = new Date();
  const sla = computeKanbanFirstContactSla({
    status: row.status,
    receivedAt,
    columnSince,
    hasCall,
    now,
    settings,
  });

  return {
    project_code: row.project_code ? String(row.project_code) : null,
    ai_band: computeKanbanPriority({
      source: row.source,
      channel: row.channel,
      need: kanbanNeedText(meta),
      receivedAt,
      now,
      settings,
    }),
    sla_state: sla.state,
    sla_late_minutes: sla.lateMinutes,
    column_minutes: sla.columnMinutes,
    stale: isKanbanStale({ status: row.status, columnSince, now, settings }),
    quote_stale: isQuoteStale({ status: row.status, receivedAt, now, settings }),
    callback_today: isCallbackToday(asDate(row.next_call_at), now),
    next_call_at: row.next_call_at ? String(row.next_call_at) : null,
    in_call: isB2bLeadInCall(row.b2b_call_state ? String(row.b2b_call_state) : null),
  };
}
