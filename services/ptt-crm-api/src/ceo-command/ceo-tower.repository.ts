import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  computeSpaMeta24hSlas,
  parseB2CompletedAt,
} from '../cskh-board/cskh-board-sla.util';
import type { TowerCandidate } from './ceo-tower.types';

const CANDIDATE_SQL = `
SELECT
  l.sqlite_lead_id AS lead_id,
  l.status,
  l.source,
  COALESCE(l.channel, '') AS channel,
  l.owner_id,
  COALESCE(l.agency_client_id::text, '') AS client_id,
  l.meta_json,
  l.created_at,
  l.updated_at,
  l.received_at,
  COALESCE(l.care_stages_done_json, '{}'::jsonb) AS care_stages_done_json,
  EXISTS (
    SELECT 1 FROM crm_lead_presales ps WHERE ps.lead_id = l.sqlite_lead_id
  ) AS has_presales,
  sl.id AS lifecycle_id,
  sl.stage AS lifecycle_stage,
  sl.status AS lifecycle_status,
  sl.updated_at AS lifecycle_updated_at,
  cs.name AS owner_name,
  p.code AS position_code,
  t.code AS team_code,
  d.code AS department_code,
  m_b2.occurred_at AS b2_at,
  m_ig.occurred_at AS intake_go_at,
  m_ca.occurred_at AS promote_at,
  m_cl.occurred_at AS client_active_at,
  ct.id AS contract_id,
  ct.status AS contract_status,
  ct.amount_vnd,
  ct.created_at AS contract_created_at,
  ct.updated_at AS contract_updated_at,
  ct.signed_on,
  ct.agency_client_id AS contract_client_id,
  ap.created_at AS approval_submitted_at,
  ap.status AS approval_status,
  ps.solution_owner_staff_id,
  fc.first_call_at,
  oa.id AS ops_alert_id,
  oa.created_at AS ops_alert_at
FROM crm_leads l
LEFT JOIN crm_service_lifecycle sl
  ON sl.lead_id = l.sqlite_lead_id
 AND sl.status IN ('active', 'draft')
LEFT JOIN crm_staff cs ON cs.id = l.owner_id
LEFT JOIN staff_users su ON lower(trim(su.email)) = lower(trim(cs.email))
LEFT JOIN crm_positions p ON p.id = su.position_id
LEFT JOIN staff_teams t ON t.id = p.team_id
LEFT JOIN crm_departments d ON d.id = t.department_id
LEFT JOIN crm_lifecycle_milestones m_b2
  ON m_b2.lead_id = l.sqlite_lead_id AND m_b2.milestone_key = 'b2_done'
LEFT JOIN crm_lifecycle_milestones m_ig
  ON m_ig.lead_id = l.sqlite_lead_id AND m_ig.milestone_key = 'intake_go'
LEFT JOIN crm_lifecycle_milestones m_ca
  ON m_ca.lead_id = l.sqlite_lead_id AND m_ca.milestone_key = 'contract_active'
LEFT JOIN crm_lifecycle_milestones m_cl
  ON m_cl.lead_id = l.sqlite_lead_id AND m_cl.milestone_key = 'client_active'
LEFT JOIN LATERAL (
  SELECT id, status, amount_vnd, created_at, updated_at, signed_on, agency_client_id
  FROM crm_contracts
  WHERE lead_id = l.sqlite_lead_id
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1
) ct ON TRUE
LEFT JOIN LATERAL (
  SELECT created_at, status
  FROM crm_contract_approvals
  WHERE contract_id = ct.id
  ORDER BY created_at DESC
  LIMIT 1
) ap ON TRUE
LEFT JOIN crm_lead_presales ps ON ps.lead_id = l.sqlite_lead_id
LEFT JOIN LATERAL (
  SELECT MIN(created_at) AS first_call_at
  FROM crm_lead_activities
  WHERE lead_id = l.sqlite_lead_id AND activity_type = 'call'
) fc ON TRUE
LEFT JOIN LATERAL (
  SELECT id, created_at
  FROM ops_alert_log
  WHERE lifecycle_id = sl.id AND status = 'open'
  ORDER BY created_at DESC
  LIMIT 1
) oa ON TRUE
WHERE l.is_duplicate IS NOT TRUE
  AND (
    COALESCE(l.updated_at, l.created_at) >= NOW() - INTERVAL '90 days'
    OR sl.status IN ('active', 'draft')
    OR COALESCE(ap.status, '') = 'pending'
    OR COALESCE(ct.status, '') IN ('draft', 'pending', 'active')
    OR lower(COALESCE(l.status, '')) IN (
      'moi', 'da_lien_he', 'dang_tu_van', 'bao_gia', 'dam_phan', 'proposal', 'won'
    )
  )
`;

@Injectable()
export class CeoTowerRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async loadCandidates(nowMs: number): Promise<TowerCandidate[]> {
    const result = await this.db.query(CANDIDATE_SQL);
    return (result.rows as Array<Record<string, unknown>>).map((row) => this.mapRow(row, nowMs));
  }

  private mapRow(row: Record<string, unknown>, nowMs: number): TowerCandidate {
    const leadId = Number(row.lead_id);
    const meta = parseMeta(row.meta_json);
    const tags = readTags(meta);
    const createdAtMs = toMs(row.created_at) ?? nowMs;
    const updatedAtMs = toMs(row.updated_at) ?? createdAtMs;
    const b2DoneAtMs = toMs(row.b2_at);
    const intakeGoAtMs = toMs(row.intake_go_at);
    const promoteAtMs = toMs(row.promote_at);
    const clientActiveAtMs = toMs(row.client_active_at);
    const approvalAt = toMs(row.approval_submitted_at);
    const contractCreated = toMs(row.contract_created_at);
    const lifecycleId = row.lifecycle_id != null ? Number(row.lifecycle_id) : null;
    const status = row.status != null ? String(row.status) : null;
    const contractStatus = String(row.contract_status ?? '');
    const approvalStatus = String(row.approval_status ?? '');
    const lifecycleStage = String(row.lifecycle_stage ?? '');
    const won = String(status ?? '').toLowerCase() === 'won';
    const hasLifecycle = lifecycleId != null && Number.isFinite(lifecycleId);
    const clientActive = clientActiveAtMs != null || lifecycleStage === 'retain';
    const retain = lifecycleStage === 'retain';
    const contractPendingOrActive =
      approvalStatus === 'pending'
      || contractStatus === 'draft'
      || contractStatus === 'pending'
      || contractStatus === 'active';
    const careJson = row.care_stages_done_json != null ? stringifyJson(row.care_stages_done_json) : null;
    const firstCallAt = row.first_call_at != null ? String(row.first_call_at) : null;
    const sla = computeSpaMeta24hSlas({
      status,
      receivedAt: row.received_at != null ? String(row.received_at) : null,
      createdAt: row.created_at != null ? String(row.created_at) : null,
      firstCallAt,
      careStagesDoneJson: careJson,
      b2CompletedAt: parseB2CompletedAt(careJson) ?? (b2DoneAtMs != null ? new Date(b2DoneAtMs).toISOString() : null),
      closedAt: null,
      now: new Date(nowMs),
    });
    const firstCall = sla.tiers.find((t) => t.tier === 'first_call_15m');
    const b2Tier = sla.tiers.find((t) => t.tier === 'b2_complete_4h');
    const closeTier = sla.tiers.find((t) => t.tier === 'close_24h');
    const signedOn = row.signed_on != null ? String(row.signed_on).slice(0, 10) : '';
    const contractEndInDays = signedOn ? daysUntil(signedOn, nowMs) : null;
    const valueRaw = row.amount_vnd;
    const valueVnd = valueRaw == null || valueRaw === '' ? null : Number(valueRaw);
    const lastActivityMs = Math.max(
      updatedAtMs,
      toMs(row.lifecycle_updated_at) ?? 0,
      toMs(row.ops_alert_at) ?? 0,
      clientActiveAtMs ?? 0,
    );

    return {
      leadId,
      lifecycleId: hasLifecycle ? lifecycleId : null,
      tags,
      clientId: row.client_id ? String(row.client_id) : null,
      channel: row.channel != null ? String(row.channel) : null,
      source: row.source != null ? String(row.source) : null,
      status,
      metaJson: meta,
      hasPresales: Boolean(row.has_presales),
      ownerId: row.owner_id != null ? Number(row.owner_id) : null,
      ownerName: String(row.owner_name ?? ''),
      departmentCode: row.department_code != null ? String(row.department_code) : null,
      teamCode: row.team_code != null ? String(row.team_code) : null,
      positionCode: row.position_code != null ? String(row.position_code) : null,
      jobFunction: null,
      createdAtMs,
      lastActivityMs,
      b2Done: b2DoneAtMs != null,
      b2DoneAtMs,
      intakeGo: intakeGoAtMs != null,
      intakeGoAtMs,
      contractPendingOrActive,
      contractSubmittedAtMs: approvalAt ?? contractCreated,
      won,
      hasLifecycle,
      clientActive,
      retain,
      spaOnBoard: Boolean(row.client_id),
      firstCallDone: Boolean(firstCallAt) || firstCall?.sla_state === 'ok',
      promoteAtMs,
      tmmtGatePass: false,
      qualityScore: null,
      launchQaFail: false,
      stageDeliver: lifecycleStage === 'deliver' || lifecycleStage === 'handover',
      opsOverdue: row.ops_alert_id != null,
      opsDueToday: false,
      cplWorse40: false,
      contractEndInDays,
      kpiRetainRed: false,
      spaFirstCallBreach: firstCall?.sla_state === 'breach',
      spaB2Breach: b2Tier?.sla_state === 'breach',
      spaCloseBreach: closeTier?.sla_state === 'breach',
      hasConsultHandoff: row.solution_owner_staff_id != null,
      valueVnd: valueVnd != null && Number.isFinite(valueVnd) ? valueVnd : null,
      opsAlertId: row.ops_alert_id != null ? Number(row.ops_alert_id) : null,
      clientUuid: row.contract_client_id != null && String(row.contract_client_id)
        ? String(row.contract_client_id)
        : (row.client_id ? String(row.client_id) : null),
    };
  }
}

function parseMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readTags(meta: Record<string, unknown>): string[] {
  const raw = meta.tags ?? meta.tag ?? meta.seed_tag;
  if (Array.isArray(raw)) return raw.map((t) => String(t));
  if (raw == null || raw === '') return [];
  return [String(raw)];
}

function stringifyJson(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  try {
    return JSON.stringify(raw ?? {});
  } catch {
    return '{}';
  }
}

function toMs(value: unknown): number | null {
  if (value == null || value === '') return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

function daysUntil(ymd: string, nowMs: number): number | null {
  const end = Date.parse(`${ymd}T00:00:00Z`);
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - nowMs) / 86_400_000);
}
