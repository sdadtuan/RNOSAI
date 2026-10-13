import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { loadPausedIntakeStaffIds } from '../ae-team/ae-intake-gate';
import {
  calendarDaysSince,
  defaultKanbanCardSettings,
  kanbanCardSettingsFromPayload,
  kanbanStatusKey,
} from '../leads/kanban-card.util';
import type { AssignPoolMember } from './b2b-assign.util';
import { assignPoolEligibleStaffSql, DEFAULT_SLA, slaHopStopCallResultSqlList } from './b2b-sla.util';
import type { B2bProjectRow } from './b2b-projects.types';

export interface OpenB2bLeadRow {
  leadId: number;
  ownerId: number | null;
  score: number | null;
  assignedAt: Date;
  hopCount: number;
  hasCallActivity: boolean;
  answered: boolean;
  projectId: string;
  aiCallEnabled: boolean;
  channel: string | null;
  source: string | null;
  phone: string | null;
}

export interface ApplyHopInput {
  leadId: number;
  fromOwnerId: number | null;
  toOwnerId: number;
  hopKind: 'first_assign' | 'sla_reassign' | 'ai_call' | 'manual';
  projectId: string;
  assignStrategy?: string;
  assignReason?: string;
  assignConfidence?: number | null;
  firstTouchPct?: number;
  closerPct?: number;
  skipOwnerUpdate?: boolean;
  updateCommissionSplit?: boolean;
}

const IN_CALL_STATES = ['queued', 'ringing', 'answered'];

@Injectable()
export class B2bSlaRepository implements OnModuleDestroy {
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

  async remindDueNurtureCalls(now = new Date()): Promise<number> {
    const due = await this.db.query(
      `SELECT sqlite_lead_id
       FROM crm_leads
       WHERE status = 'nurture'
         AND next_call_at IS NOT NULL
         AND next_call_at <= $1::timestamptz
         AND NOT EXISTS (
           SELECT 1 FROM crm_lead_activities a
           WHERE a.lead_id = crm_leads.sqlite_lead_id
             AND a.next_action = 'nurture_callback'
         )
       LIMIT 50`,
      [now.toISOString()],
    );
    let created = 0;
    for (const row of due.rows as Array<{ sqlite_lead_id: number }>) {
      const leadId = Number(row.sqlite_lead_id);
      await this.db.query(
        `INSERT INTO crm_lead_activities (
           lead_id, activity_type, content, result, next_action, created_at, created_by, lead_status_at_log
         ) VALUES ($1, 'note', $2, '', 'nurture_callback', NOW(), 'system', 'nurture')`,
        [leadId, 'Đến hạn gọi lại lead chăm sóc.'],
      );
      created += 1;
    }
    return created;
  }

  /** Mark cards that stood past settings.stale_days. Owner first, leader one day later. */
  async remindStaleKanban(now = new Date()): Promise<number> {
    let settings = defaultKanbanCardSettings();
    try {
      const payload = await this.db.query(
        `SELECT payload FROM crm_lead_sla_settings WHERE tenant_id = 'default' LIMIT 1`,
      );
      if (payload.rows[0]) settings = kanbanCardSettingsFromPayload(payload.rows[0].payload);
    } catch {
      settings = defaultKanbanCardSettings();
    }
    const statuses = [
      ...new Set([
        ...Object.keys(settings.stale_days),
        'new',
        'first_contact',
        'proposal',
        'dam_phan',
      ]),
    ];
    const due = await this.db.query(
      `SELECT sqlite_lead_id, lower(status) AS status,
              COALESCE(
                CASE WHEN lower(status) IN ('moi', 'new', 'intake') THEN received_at ELSE updated_at END,
                received_at,
                created_at
              ) AS stood_at
       FROM crm_leads
       WHERE COALESCE(is_duplicate, FALSE) IS NOT TRUE
         AND COALESCE(meta_json->>'lead_flow_kind', '') IN ('b2b_prospect', 'b2b')
         AND lower(status) = ANY($1::text[])
       LIMIT 200`,
      [statuses],
    );
    const staleRows = (due.rows as Array<{ sqlite_lead_id: number; status: string; stood_at: string }>).flatMap(
      (row) => {
        const limit = settings.stale_days[kanbanStatusKey(row.status)];
        const stoodAt = row.stood_at ? new Date(row.stood_at) : null;
        const age = calendarDaysSince(stoodAt, now);
        if (!limit || age < limit) return [];
        return [{ id: Number(row.sqlite_lead_id), leader: age >= limit + 1 }];
      },
    );
    if (!staleRows.length) return 0;
    const existing = await this.db.query(
      `SELECT lead_id, next_action
       FROM crm_lead_activities
       WHERE lead_id = ANY($1::int[])
         AND next_action IN ('stale_owner_remind', 'stale_leader_notify')`,
      [staleRows.map((row) => row.id)],
    );
    const seen = new Set(
      (existing.rows as Array<{ lead_id: number; next_action: string }>).map(
        (row) => `${row.lead_id}:${row.next_action}`,
      ),
    );
    let created = 0;
    for (const row of staleRows) {
      if (created >= 50) break;
      if (!seen.has(`${row.id}:stale_owner_remind`)) {
        await this.db.query(
          `INSERT INTO crm_lead_activities (
             lead_id, activity_type, content, result, next_action, created_at, created_by, lead_status_at_log
           ) VALUES ($1, 'note', $2, '', 'stale_owner_remind', NOW(), 'system', '')`,
          [row.id, 'Lead đứng yên quá hạn. Nhắc người phụ trách.'],
        );
        created += 1;
      }
      if (created >= 50) break;
      if (row.leader && !seen.has(`${row.id}:stale_leader_notify`)) {
        await this.db.query(
          `INSERT INTO crm_lead_activities (
             lead_id, activity_type, content, result, next_action, created_at, created_by, lead_status_at_log
           ) VALUES ($1, 'note', $2, '', 'stale_leader_notify', NOW(), 'system', '')`,
          [row.id, 'Lead đứng yên thêm 1 ngày. Nhắc leader.'],
        );
        created += 1;
      }
    }
    return created;
  }

  async listPausedIntakeStaffIds(): Promise<Set<number>> {
    return loadPausedIntakeStaffIds((sql) => this.db.query(sql));
  }

  async loadAssignPool(
    projectId: string,
    opts?: { excludeStaffId?: number | null },
  ): Promise<AssignPoolMember[]> {
    const result = await this.db.query(
      `SELECT ps.staff_id,
              ps.sales_level,
              (
                SELECT COUNT(*)::int
                FROM crm_leads l
                WHERE l.owner_id = ps.staff_id
                  AND l.b2b_project_id = ps.project_id
                  AND COALESCE(l.is_duplicate, FALSE) IS NOT TRUE
                  AND COALESCE(l.meta_json->>'lead_flow_kind', '') IN ('b2b_prospect', 'b2b')
              ) AS open_first_touch,
              EXISTS (
                SELECT 1 FROM crm_b2b_call_sessions c
                WHERE c.staff_id = ps.staff_id
                  AND c.state = ANY($2::varchar[])
              ) AS in_call
       FROM crm_b2b_project_staff ps
       JOIN crm_staff s ON s.id = ps.staff_id
       WHERE ps.project_id = $1::uuid
         AND ps.assign_enabled = TRUE
         AND ${assignPoolEligibleStaffSql('s')}
       ORDER BY ps.staff_id ASC`,
      [projectId, IN_CALL_STATES],
    );
    return result.rows
      .map((row) => ({
        staffId: Number(row.staff_id),
        salesLevel: String(row.sales_level ?? 'b'),
        openFirstTouch: Number(row.open_first_touch ?? 0),
        inCall: Boolean(row.in_call),
      }))
      .filter((row) => row.staffId !== opts?.excludeStaffId);
  }

  async getProject(projectId: string): Promise<B2bProjectRow | null> {
    const result = await this.db.query(
      `SELECT id::text, owner_company_id::text, code, name, status,
              business_hours_json, sla_json, commission_json,
              ai_call_enabled, manual_ingest_enabled,
              created_at::text, updated_at::text
       FROM crm_b2b_projects WHERE id = $1::uuid LIMIT 1`,
      [projectId],
    );
    return (result.rows[0] as B2bProjectRow | undefined) ?? null;
  }

  async listOpenB2bLeads(): Promise<OpenB2bLeadRow[]> {
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS lead_id,
              l.owner_id,
              COALESCE((l.meta_json->>'lead_score')::numeric, NULL) AS score,
              COALESCE(
                NULLIF(l.meta_json->>'auto_assigned_at', '')::timestamptz,
                l.received_at,
                l.created_at
              ) AS assigned_at,
              (
                SELECT COUNT(*)::int FROM crm_b2b_lead_hops h
                WHERE h.lead_id = l.sqlite_lead_id AND h.hop_kind = 'sla_reassign'
              ) AS hop_count,
              EXISTS (
                SELECT 1 FROM crm_b2b_call_sessions c
                WHERE c.lead_id = l.sqlite_lead_id AND c.kind = 'human'
              ) AS has_call_activity,
              COALESCE((l.meta_json->>'b2b_call_answered')::boolean, FALSE) AS answered,
              l.b2b_project_id::text AS project_id,
              p.ai_call_enabled,
              l.channel,
              l.source,
              l.phone
       FROM crm_leads l
       JOIN crm_b2b_projects p ON p.id = l.b2b_project_id
       WHERE l.b2b_project_id IS NOT NULL
         AND COALESCE(l.is_duplicate, FALSE) IS NOT TRUE
         AND l.owner_id IS NOT NULL
         AND COALESCE(l.meta_json->>'lead_flow_kind', '') IN ('b2b_prospect', 'b2b')
         AND COALESCE(l.meta_json->>'b2b_gdkd_queue', 'false') <> 'true'
         AND lower(COALESCE(l.status, '')) NOT IN ('lost', 'chot')
         -- Đã qua B2 hoặc AE đã ghi «đã nói chuyện» ở phản hồi đầu → không hop
         AND COALESCE(l.care_stages_done_json->>'first_contact', '') = ''
         AND NOT EXISTS (
           SELECT 1 FROM crm_lead_activities a
           WHERE a.lead_id = l.sqlite_lead_id
             AND a.care_stage_key = 'first_contact'
             AND a.activity_type <> 'system'
             AND trim(COALESCE(a.care_status, '')) = 'da_lien_he_thanh_cong'
         )
         AND COALESCE(l.last_call_result, '') NOT IN (${slaHopStopCallResultSqlList()})
         AND NOT EXISTS (
           SELECT 1 FROM crm_lead_call_attempts ca
           WHERE ca.sqlite_lead_id = l.sqlite_lead_id
             AND ca.call_result IN (${slaHopStopCallResultSqlList()})
         )`,
    );
    return result.rows.map((row) => ({
      leadId: Number(row.lead_id),
      ownerId: row.owner_id != null ? Number(row.owner_id) : null,
      score: row.score != null ? Number(row.score) : null,
      assignedAt: new Date(row.assigned_at),
      hopCount: Number(row.hop_count ?? 0),
      hasCallActivity: Boolean(row.has_call_activity),
      answered: Boolean(row.answered),
      projectId: String(row.project_id),
      aiCallEnabled: Boolean(row.ai_call_enabled),
      channel: row.channel ? String(row.channel) : null,
      source: row.source ? String(row.source) : null,
      phone: row.phone ? String(row.phone) : null,
    }));
  }

  async applyHop(input: ApplyHopInput): Promise<void> {
    const client = await this.db.connect();
    const firstTouchPct = input.firstTouchPct ?? 30;
    const closerPct = input.closerPct ?? 70;
    const updateSplit = input.updateCommissionSplit !== false;
    try {
      await client.query('BEGIN');
      if (!input.skipOwnerUpdate) {
        await client.query(
          `UPDATE crm_leads
           SET owner_id = $2,
               assign_strategy = COALESCE($3, assign_strategy),
               meta_json = COALESCE(meta_json, '{}'::jsonb) || jsonb_build_object(
                 'assign_reason', COALESCE($4, meta_json->>'assign_reason'),
                 'assign_confidence', COALESCE($5::text, meta_json->>'assign_confidence'),
                 'auto_assigned_at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
               ),
               updated_at = NOW()
           WHERE sqlite_lead_id = $1`,
          [
            input.leadId,
            input.toOwnerId,
            input.assignStrategy ?? null,
            input.assignReason ?? null,
            input.assignConfidence != null ? String(input.assignConfidence) : null,
          ],
        );
      }
      await client.query(
        `INSERT INTO crm_b2b_lead_hops (lead_id, from_owner_id, to_owner_id, hop_kind, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          input.leadId,
          input.fromOwnerId,
          input.toOwnerId,
          input.hopKind,
          input.assignReason ?? input.hopKind,
        ],
      );

      if (updateSplit) {
        const firstTouchRow = await client.query(
          `SELECT first_touch_staff_id, first_touch_pct, closer_pct
           FROM crm_b2b_lead_commission_split WHERE lead_id = $1`,
          [input.leadId],
        );
        let firstTouchStaffId = firstTouchRow.rows[0]?.first_touch_staff_id as number | undefined;
        if (!firstTouchStaffId) {
          const hopRow = await client.query(
            `SELECT to_owner_id FROM crm_b2b_lead_hops
             WHERE lead_id = $1 AND hop_kind = 'first_assign'
             ORDER BY created_at ASC LIMIT 1`,
            [input.leadId],
          );
          firstTouchStaffId =
            hopRow.rows[0]?.to_owner_id != null
              ? Number(hopRow.rows[0].to_owner_id)
              : input.fromOwnerId ?? input.toOwnerId;
        }

        await client.query(
          `INSERT INTO crm_b2b_lead_commission_split
             (lead_id, first_touch_staff_id, closer_staff_id, first_touch_pct, closer_pct)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (lead_id) DO UPDATE SET
             closer_staff_id = EXCLUDED.closer_staff_id,
             first_touch_pct = EXCLUDED.first_touch_pct,
             closer_pct = EXCLUDED.closer_pct`,
          [input.leadId, firstTouchStaffId, input.toOwnerId, firstTouchPct, closerPct],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async markGdkdQueue(leadId: number): Promise<void> {
    await this.db.query(
      `UPDATE crm_leads
       SET meta_json = COALESCE(meta_json, '{}'::jsonb) || '{"b2b_gdkd_queue": true}'::jsonb,
           updated_at = NOW()
       WHERE sqlite_lead_id = $1`,
      [leadId],
    );
  }

  resolveSlaConfig(project: B2bProjectRow | null): typeof DEFAULT_SLA {
    const raw = project?.sla_json;
    if (!raw || typeof raw !== 'object') return DEFAULT_SLA;
    const cfg = raw as Record<string, unknown>;
    return {
      hot: { ...(DEFAULT_SLA.hot as object), ...(cfg.hot as object) } as typeof DEFAULT_SLA.hot,
      warm: { ...(DEFAULT_SLA.warm as object), ...(cfg.warm as object) } as typeof DEFAULT_SLA.warm,
      cold: { ...(DEFAULT_SLA.cold as object), ...(cfg.cold as object) } as typeof DEFAULT_SLA.cold,
      maxHops: Number(cfg.maxHops ?? cfg.max_hops ?? DEFAULT_SLA.maxHops),
    };
  }

  resolveBusinessHours(project: B2bProjectRow | null): {
    tz: string;
    days: number[];
    start: string;
    end: string;
  } {
    const raw = project?.business_hours_json;
    if (!raw || typeof raw !== 'object') {
      return { tz: 'Asia/Ho_Chi_Minh', days: [1, 2, 3, 4, 5, 6], start: '08:00', end: '18:00' };
    }
    const h = raw as Record<string, unknown>;
    return {
      tz: String(h.tz ?? 'Asia/Ho_Chi_Minh'),
      days: Array.isArray(h.days) ? h.days.map(Number) : [1, 2, 3, 4, 5, 6],
      start: String(h.start ?? '08:00'),
      end: String(h.end ?? '18:00'),
    };
  }

  resolveCommission(project: B2bProjectRow | null): { firstTouchPct: number; closerPct: number } {
    const raw = project?.commission_json;
    return {
      firstTouchPct: Number(raw?.first_touch_pct ?? 30),
      closerPct: Number(raw?.closer_pct ?? 70),
    };
  }

  async getCommissionSplit(leadId: number): Promise<{
    first_touch_pct: number;
    closer_pct: number;
  } | null> {
    const result = await this.db.query(
      `SELECT first_touch_pct, closer_pct
       FROM crm_b2b_lead_commission_split WHERE lead_id = $1 LIMIT 1`,
      [leadId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      first_touch_pct: Number(row.first_touch_pct),
      closer_pct: Number(row.closer_pct),
    };
  }
}
