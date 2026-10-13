import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { resolveLeadFlowKind, type LeadFlowKind } from '../leads-funnel/lead-flow-kind.util';
import {
  CONTACT_OK_CARE_STATUS,
  computeAllowedNextStatuses,
  computeB2Complete,
  KANBAN_LOST_REASON_SEED,
  kanbanLostReasonsFromPayload,
  leadStatusLabel,
  LeadStatusGateError,
  LeadStatusOptionRow,
  normalizeLeadStatus,
  validateLeadStatusChange,
  type KanbanLostReason,
} from './lead-status-gate.util';
import { PatchLeadV1Body } from './leads.types';

export interface LeadStatusGatePatchOptions {
  allowStatusOverride?: boolean;
}

export interface LeadStatusOptionsResponse {
  current_status: string;
  current_status_label: string;
  lead_flow_kind: LeadFlowKind;
  gate_enabled: boolean;
  allowed_next: LeadStatusOptionRow[];
  hints: string[];
  lost_reasons: KanbanLostReason[];
}

@Injectable()
export class LeadStatusGateService implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  isEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_LEAD_STATUS_GATE ?? '1').trim().toLowerCase(),
    );
  }

  async getStatusOptions(leadId: number): Promise<LeadStatusOptionsResponse> {
    const state = await this.loadLeadGateState(leadId);
    if (!state) {
      throw new NotFoundException({ error: 'Not found' });
    }

    const current = normalizeLeadStatus(state.status);
    const lostReasons = await this.loadLostReasons();
    const { options, hints } = computeAllowedNextStatuses({
      currentStatus: current,
      flowKind: state.flowKind,
      b2Complete: state.b2Complete,
      hasOutreachActivity: state.hasOutreachActivity,
      needsCleanup: state.needsCleanup,
      gateEnabled: this.isEnabled(),
    });

    return {
      current_status: current,
      current_status_label: leadStatusLabel(current),
      lead_flow_kind: state.flowKind,
      gate_enabled: this.isEnabled(),
      allowed_next: options,
      hints,
      lost_reasons: lostReasons,
    };
  }

  async assertPatchAllowed(
    leadId: number,
    body: PatchLeadV1Body,
    opts: LeadStatusGatePatchOptions = {},
  ): Promise<void> {
    if (!this.isEnabled() || body.status === undefined) return;

    const ctx = await this.loadContext(leadId, body, opts);
    try {
      validateLeadStatusChange(ctx);
    } catch (err) {
      if (err instanceof LeadStatusGateError) {
        throw err;
      }
      throw err;
    }
  }

  private async loadContext(
    leadId: number,
    body: PatchLeadV1Body,
    opts: LeadStatusGatePatchOptions,
  ) {
    const state = await this.loadLeadGateState(leadId);
    if (!state) {
      throw new LeadStatusGateError('lead_not_found', 'Không tìm thấy lead.');
    }

    return {
      oldStatus: String(state.status ?? 'moi'),
      newStatus: String(body.status ?? '').trim(),
      auditNote: String(body.audit_note ?? '').trim(),
      allowOverride: Boolean(opts.allowStatusOverride && body.allow_status_override),
      overrideReason: String(body.status_override_reason ?? body.audit_note ?? '').trim(),
      b2Complete: state.b2Complete,
      hasOutreachActivity: state.hasOutreachActivity,
      needsCleanup: state.needsCleanup,
      flowKind: state.flowKind,
      hasCallLog: state.hasCallLog,
      contactNote: String(body.contact_note ?? '').trim(),
      lostReason: String(body.lost_reason ?? '').trim(),
      lostReasonNote: String(body.lost_reason_note ?? '').trim(),
      nextCallAt: body.next_call_at ?? null,
      hasQuote: state.hasQuote || isQuoteLink(body.quote_url),
      quoteValue: quoteValue(body.expected_value, state.quoteValue),
      lostReasons: state.lostReasons,
    };
  }

  private async loadLeadGateState(leadId: number): Promise<{
    status: string;
    flowKind: LeadFlowKind;
    b2Complete: boolean;
    hasOutreachActivity: boolean;
    needsCleanup: boolean;
    hasCallLog: boolean;
    hasQuote: boolean;
    quoteValue: number | null;
    lostReasons: KanbanLostReason[];
  } | null> {
    const row = await this.fetchLeadRow(leadId);
    if (!row) return null;

    const [hasContactOkReport, hasOutreachActivity, hasPresales, quote, lostReasons] = await Promise.all([
      this.hasContactOkReport(leadId),
      this.hasOutreachActivity(leadId),
      this.hasPresales(leadId),
      this.loadQuote(leadId, row.meta_json),
      this.loadLostReasons(),
    ]);

    const b2Complete = computeB2Complete({
      careStageCurrent: row.care_stage_current,
      careStagesDoneJson: row.care_stages_done_json,
      hasContactOkReport,
    });

    const needsCleanup = this.leadNeedsCleanup(row.full_name, row.phone);

    const flowKind = resolveLeadFlowKind({
      clientId: row.client_id,
      channel: row.channel,
      source: row.source,
      status: row.status,
      metaJson: row.meta_json,
      hasPresales,
    });

    return {
      status: String(row.status ?? 'moi'),
      flowKind,
      b2Complete,
      hasOutreachActivity,
      needsCleanup,
      hasCallLog: Boolean(row.last_call_at),
      hasQuote: quote.hasQuote,
      quoteValue: quote.quoteValue,
      lostReasons,
    };
  }

  private async fetchLeadRow(leadId: number): Promise<{
    status: string | null;
    full_name: string | null;
    phone: string | null;
    source: string | null;
    channel: string | null;
    client_id: string | null;
    meta_json: string | null;
    care_stage_current: string | null;
    care_stages_done_json: string | null;
    last_call_at: string | null;
  } | null> {
    const result = await this.db.query(
      `SELECT status, full_name, phone, source,
              COALESCE(agency_client_id::text, '') AS client_id,
              COALESCE(channel, '') AS channel,
              meta_json::text AS meta_json,
              COALESCE(care_stage_current, 'first_contact') AS care_stage_current,
              COALESCE(care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json,
              last_call_at::text AS last_call_at
       FROM crm_leads
       WHERE sqlite_lead_id = $1
       LIMIT 1`,
      [leadId],
    );
    return (result.rows[0] as typeof result.rows[0] | undefined) ?? null;
  }

  private async hasPresales(leadId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_presales WHERE lead_id = $1 LIMIT 1`,
      [leadId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async hasContactOkReport(leadId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_activities
       WHERE lead_id = $1 AND care_stage_key = 'first_contact'
         AND activity_type != 'system'
         AND trim(COALESCE(care_status, '')) = $2
       LIMIT 1`,
      [leadId, CONTACT_OK_CARE_STATUS],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async hasOutreachActivity(leadId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM crm_lead_activities
       WHERE lead_id = $1
         AND activity_type = ANY($2::text[])
       LIMIT 1`,
      [leadId, ['call', 'email', 'message', 'meeting']],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async loadLostReasons(): Promise<KanbanLostReason[]> {
    try {
      const result = await this.db.query(
        `SELECT payload
         FROM crm_lead_sla_settings
         WHERE is_active IS TRUE
         ORDER BY id DESC
         LIMIT 1`,
      );
      return kanbanLostReasonsFromPayload(result.rows[0]?.payload ?? null);
    } catch {
      return KANBAN_LOST_REASON_SEED.map((row) => ({ ...row }));
    }
  }

  private async loadQuote(
    leadId: number,
    metaJson: string | null,
  ): Promise<{ hasQuote: boolean; quoteValue: number | null }> {
    const meta = parseMetaObject(metaJson);
    const metaValue = numberOrNull(metaValueOf(meta, 'expected_value'));
    const metaLink = isQuoteLink(metaString(meta, 'quote_url'));
    let proposalValue: number | null = null;
    let proposalAttached = false;
    try {
      const result = await this.db.query(
        `SELECT COALESCE(total_vnd, 0)::float8 AS total_vnd,
                COALESCE(notes, '') AS notes
         FROM crm_proposals
         WHERE lead_id = $1`,
        [leadId],
      );
      for (const row of result.rows as Array<{ total_vnd: number; notes: string }>) {
        const total = Number(row.total_vnd);
        if (Number.isFinite(total) && total > 0) {
          proposalAttached = true;
          proposalValue = Math.max(proposalValue ?? 0, total);
        }
        if (isQuoteLink(row.notes)) proposalAttached = true;
      }
    } catch {
      proposalAttached = false;
    }
    const quoteValue = metaValue ?? proposalValue;
    return {
      hasQuote: metaLink || proposalAttached,
      quoteValue,
    };
  }

  private leadNeedsCleanup(fullName: string | null, phone: string | null): boolean {
    const name = String(fullName ?? '').trim();
    const ph = String(phone ?? '').trim();
    return name.length < 2 || ph.length < 8;
  }
}

function isQuoteLink(value: unknown): boolean {
  return /https?:\/\/\S+/i.test(String(value ?? '').trim());
}

function quoteValue(fromBody: number | null | undefined, fromState: number | null): number | null {
  if (fromBody != null && Number.isFinite(Number(fromBody))) return Number(fromBody);
  return fromState;
}

function parseMetaObject(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function metaString(meta: Record<string, unknown>, key: string): string {
  const financial =
    meta.financial && typeof meta.financial === 'object'
      ? (meta.financial as Record<string, unknown>)
      : null;
  const val = meta[key] ?? financial?.[key];
  return val == null ? '' : String(val);
}

function metaValueOf(meta: Record<string, unknown>, key: string): unknown {
  const financial =
    meta.financial && typeof meta.financial === 'object'
      ? (meta.financial as Record<string, unknown>)
      : null;
  return financial?.[key] ?? meta[key];
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
