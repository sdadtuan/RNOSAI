import { ForbiddenException, Injectable } from '@nestjs/common';
import { hasRevopsCommissionCap } from './revops-scope.util';
import {
  REVOPS_SLA_COMPLIANCE_TARGET_PCT,
  REVOPS_SLA_DEFAULT_POLICIES,
  assignableLeadId,
  entityTypeLabel,
  type ComposedSlaSourceRow,
} from './revops-sla-compose.util';
import { REVOPS_TENANT_ID, RevopsW3Repository, isMissingRelation } from './revops-w3.repository';
import type {
  RevopsCreateSlaPolicyBody,
  RevopsSlaCenterDto,
  RevopsSlaIncidentDto,
  RevopsSlaPolicyDto,
  RevopsUpdateSlaPolicyBody,
} from './revops.types';

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapPolicy(row: Record<string, unknown>): RevopsSlaPolicyDto {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    entityType: String(row.entity_type ?? ''),
    durationMinutes: num(row.duration_minutes),
    warningMinutes: num(row.warning_minutes),
    escalateJson: row.escalate_json ?? [],
  };
}

function mapIncident(row: Record<string, unknown>): RevopsSlaIncidentDto {
  const entityType = String(row.entity_type ?? '');
  const entityId = String(row.entity_id ?? '');
  return {
    id: String(row.id ?? ''),
    entityType,
    entityId,
    policyId: row.policy_id ? String(row.policy_id) : null,
    ownerId: row.owner_id == null ? null : num(row.owner_id),
    dueAt: String(row.due_at ?? ''),
    breachedAt: row.breached_at ? String(row.breached_at) : null,
    status: String(row.status ?? ''),
    title: String(row.title ?? entityTypeLabel(entityType)),
    assignableLeadId: assignableLeadId(entityType, entityId),
  };
}

const COMPOSE_LEADS_SQL = `
  SELECT 'lead_first_response' AS entity_type,
         l.sqlite_lead_id::text AS entity_id,
         l.owner_id::int AS owner_id,
         (
           COALESCE(
             l.first_assigned_at,
             (SELECT al.created_at FROM crm_lead_assignment_log al
               WHERE al.sqlite_lead_id = l.sqlite_lead_id AND al.to_owner_id IS NOT NULL
               ORDER BY al.created_at ASC LIMIT 1),
             l.received_at,
             l.created_at
           ) + ($2 || ' minutes')::interval
         ) AS due_at,
         COALESCE(NULLIF(trim(l.full_name), ''), 'Lead #' || l.sqlite_lead_id::text) AS title
    FROM crm_leads l
   WHERE l.is_duplicate IS NOT TRUE
     AND l.owner_id IS NOT NULL
     AND lower(trim(l.status)) NOT IN ('won', 'lost', 'closed', 'chot', 'khong_chot', 'da_chot')
     AND NOT EXISTS (
       SELECT 1 FROM crm_lead_activities a
        WHERE a.lead_id = l.sqlite_lead_id
          AND a.activity_type IN ('call', 'note', 'email', 'meeting', 'zalo', 'sms')
     )
   ORDER BY due_at ASC
   LIMIT 100`;

const COMPOSE_HANDOVER_SQL = `
  SELECT 'handover_accept' AS entity_type,
         h.id::text AS entity_id,
         e.account_owner_staff_id::int AS owner_id,
         (h.created_at + ($2 || ' minutes')::interval) AS due_at,
         COALESCE(c.name, c.code, 'Handover') AS title
    FROM crm_am_handovers h
    JOIN crm_am_account_ext e ON e.agency_client_id = h.agency_client_id AND e.tenant_id = h.tenant_id
    JOIN clients c ON c.id = h.agency_client_id
   WHERE h.tenant_id = $1
     AND h.status = 'pending_am'
   ORDER BY due_at ASC
   LIMIT 100`;

const COMPOSE_RENEWAL_SQL = `
  SELECT 'renewal_prep' AS entity_type,
         r.id::text AS entity_id,
         e.account_owner_staff_id::int AS owner_id,
         (r.updated_at + ($2 || ' minutes')::interval) AS due_at,
         COALESCE(c.name, 'Renewal') AS title
    FROM crm_am_renewal_cases r
    JOIN crm_am_account_ext e ON e.agency_client_id = r.agency_client_id AND e.tenant_id = r.tenant_id
    JOIN clients c ON c.id = r.agency_client_id
   WHERE r.tenant_id = $1
     AND r.status IN ('not_started', 'evaluating', 'negotiating')
   ORDER BY due_at ASC
   LIMIT 100`;

@Injectable()
export class RevopsSlaService {
  constructor(private readonly db: RevopsW3Repository) {}

  async getCenter(): Promise<RevopsSlaCenterDto> {
    try {
      await this.syncComposedIncidents();
      const [incidents, policies, trend, reassignCount] = await Promise.all([
        this.db.query(
          `SELECT id, entity_type, entity_id, policy_id, owner_id, due_at, breached_at, status
             FROM crm_revops_sla_incidents
            WHERE tenant_id = $1 AND status IN ('open', 'warning', 'breached')
            ORDER BY due_at ASC
            LIMIT 200`,
          [REVOPS_TENANT_ID],
        ),
        this.db.query(
          `SELECT id, name, entity_type, duration_minutes, warning_minutes, escalate_json
             FROM crm_revops_sla_policies
            WHERE tenant_id = $1
            ORDER BY name`,
          [REVOPS_TENANT_ID],
        ),
        this.breachTrend7d(),
        this.countAutoReassignments(),
      ]);
      const items = incidents.rows.map(mapIncident);
      const openWarnings = items.filter((i) => i.status === 'warning').length;
      const breaches = items.filter((i) => i.status === 'breached').length;
      const open = items.filter((i) => i.status === 'open').length;
      const total = open + openWarnings + breaches;
      const compliancePct = total === 0 ? null : Math.round(((total - breaches) / total) * 100);
      return {
        kpis: {
          compliancePct,
          complianceTargetPct: REVOPS_SLA_COMPLIANCE_TARGET_PCT,
          openWarnings,
          breaches,
          autoReassignments: reassignCount,
        },
        incidents: items,
        policies: policies.rows.map(mapPolicy),
        breachTrend7d: trend,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (isMissingRelation(err)) {
        return {
          kpis: {
            compliancePct: null,
            complianceTargetPct: REVOPS_SLA_COMPLIANCE_TARGET_PCT,
            openWarnings: 0,
            breaches: 0,
            autoReassignments: 0,
          },
          incidents: [],
          policies: [],
          breachTrend7d: [],
          fetchedAt: new Date().toISOString(),
        };
      }
      throw err;
    }
  }

  async createPolicy(
    caps: Array<{ section: string; action: string }>,
    body: RevopsCreateSlaPolicyBody,
  ): Promise<RevopsSlaPolicyDto> {
    this.requireManage(caps);
    const name = String(body.name ?? '').trim();
    const entityType = String(body.entity_type ?? '').trim();
    const durationMinutes = num(body.duration_minutes);
    const warningMinutes = num(body.warning_minutes);
    if (!name || !entityType || durationMinutes <= 0) {
      throw new ForbiddenException({ error: 'invalid_policy' });
    }
    const inserted = await this.db.query(
      `INSERT INTO crm_revops_sla_policies (
         tenant_id, name, entity_type, duration_minutes, warning_minutes, escalate_json
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, name, entity_type, duration_minutes, warning_minutes, escalate_json`,
      [
        REVOPS_TENANT_ID,
        name,
        entityType,
        durationMinutes,
        warningMinutes || Math.floor(durationMinutes * 0.6),
        JSON.stringify(body.escalate_json ?? []),
      ],
    );
    return mapPolicy(inserted.rows[0]!);
  }

  async updatePolicy(
    caps: Array<{ section: string; action: string }>,
    id: string,
    body: RevopsUpdateSlaPolicyBody,
  ): Promise<RevopsSlaPolicyDto> {
    this.requireManage(caps);
    const updated = await this.db.query(
      `UPDATE crm_revops_sla_policies
          SET name = COALESCE($3, name),
              duration_minutes = COALESCE($4, duration_minutes),
              warning_minutes = COALESCE($5, warning_minutes)
        WHERE tenant_id = $1 AND id = $2::uuid
        RETURNING id, name, entity_type, duration_minutes, warning_minutes, escalate_json`,
      [
        REVOPS_TENANT_ID,
        id,
        body.name?.trim() || null,
        body.duration_minutes ?? null,
        body.warning_minutes ?? null,
      ],
    );
    if (!updated.rows[0]) throw new ForbiddenException({ error: 'policy_not_found' });
    return mapPolicy(updated.rows[0]);
  }

  async deletePolicy(caps: Array<{ section: string; action: string }>, id: string): Promise<{ ok: true }> {
    this.requireManage(caps);
    const deleted = await this.db.query(
      `DELETE FROM crm_revops_sla_policies WHERE tenant_id = $1 AND id = $2::uuid RETURNING id`,
      [REVOPS_TENANT_ID, id],
    );
    if (!deleted.rows[0]) throw new ForbiddenException({ error: 'policy_not_found' });
    return { ok: true };
  }

  async syncComposedIncidents(): Promise<number> {
    const policyMap = await this.ensureDefaultPolicies();
    let synced = 0;
    for (const [entityType, policy] of policyMap.entries()) {
      const rows = await this.composeSourceRows(entityType, policy.durationMinutes);
      for (const row of rows) {
        const inserted = await this.db.query(
          `INSERT INTO crm_revops_sla_incidents (
             tenant_id, entity_type, entity_id, policy_id, owner_id, due_at, status
           )
           SELECT $1, $2, $3, $4::uuid, $5, $6::timestamptz, 'open'
            WHERE NOT EXISTS (
              SELECT 1 FROM crm_revops_sla_incidents
               WHERE tenant_id = $1
                 AND entity_type = $2
                 AND entity_id = $3
                 AND status IN ('open', 'warning', 'breached')
            )
           RETURNING id`,
          [REVOPS_TENANT_ID, row.entity_type, row.entity_id, policy.id, row.owner_id, row.due_at],
        );
        if (inserted.rows[0]) synced += 1;
      }
    }
    return synced;
  }

  async tick(now = new Date()): Promise<{
    processed: number;
    warnings: number;
    breaches: number;
    reminders: number;
    reassignments: number;
  }> {
    const at = now.toISOString();
    try {
      await this.syncComposedIncidents();
      const warned = await this.db.query(
        `UPDATE crm_revops_sla_incidents i
            SET status = 'warning'
           FROM crm_revops_sla_policies p
          WHERE i.policy_id = p.id
            AND i.tenant_id = $1
            AND i.status = 'open'
            AND $2::timestamptz >= i.due_at - (p.warning_minutes || ' minutes')::interval
            AND $2::timestamptz < i.due_at
         RETURNING i.id`,
        [REVOPS_TENANT_ID, at],
      );
      const breached = await this.db.query(
        `UPDATE crm_revops_sla_incidents
            SET status = 'breached', breached_at = COALESCE(breached_at, $2::timestamptz)
          WHERE tenant_id = $1
            AND status IN ('open', 'warning')
            AND due_at <= $2::timestamptz
         RETURNING id`,
        [REVOPS_TENANT_ID, at],
      );
      const reminders = await this.sendReminders(at);
      const reassignments = await this.autoReassignBreached(at);
      const warnings = warned.rowCount ?? 0;
      const breaches = breached.rowCount ?? 0;
      return {
        processed: warnings + breaches + reminders + reassignments,
        warnings,
        breaches,
        reminders,
        reassignments,
      };
    } catch (err) {
      if (isMissingRelation(err)) {
        return { processed: 0, warnings: 0, breaches: 0, reminders: 0, reassignments: 0 };
      }
      throw err;
    }
  }

  private async ensureDefaultPolicies(): Promise<
    Map<string, { id: string; durationMinutes: number; warningMinutes: number }>
  > {
    const map = new Map<string, { id: string; durationMinutes: number; warningMinutes: number }>();
    for (const def of REVOPS_SLA_DEFAULT_POLICIES) {
      const existing = await this.db.query(
        `SELECT id, duration_minutes, warning_minutes
           FROM crm_revops_sla_policies
          WHERE tenant_id = $1 AND entity_type = $2
          ORDER BY created_at ASC
          LIMIT 1`,
        [REVOPS_TENANT_ID, def.entityType],
      );
      if (existing.rows[0]) {
        map.set(def.entityType, {
          id: String(existing.rows[0].id),
          durationMinutes: num(existing.rows[0].duration_minutes),
          warningMinutes: num(existing.rows[0].warning_minutes),
        });
        continue;
      }
      const inserted = await this.db.query(
        `INSERT INTO crm_revops_sla_policies (
           tenant_id, name, entity_type, duration_minutes, warning_minutes, escalate_json
         ) VALUES ($1, $2, $3, $4, $5, '[]'::jsonb)
         RETURNING id, duration_minutes, warning_minutes`,
        [REVOPS_TENANT_ID, def.name, def.entityType, def.durationMinutes, def.warningMinutes],
      );
      const row = inserted.rows[0]!;
      map.set(def.entityType, {
        id: String(row.id),
        durationMinutes: num(row.duration_minutes),
        warningMinutes: num(row.warning_minutes),
      });
    }
    const custom = await this.db.query(
      `SELECT id, entity_type, duration_minutes, warning_minutes
         FROM crm_revops_sla_policies
        WHERE tenant_id = $1`,
      [REVOPS_TENANT_ID],
    );
    for (const row of custom.rows) {
      const entityType = String(row.entity_type ?? '');
      if (!map.has(entityType)) {
        map.set(entityType, {
          id: String(row.id),
          durationMinutes: num(row.duration_minutes),
          warningMinutes: num(row.warning_minutes),
        });
      }
    }
    return map;
  }

  private async composeSourceRows(
    entityType: string,
    durationMinutes: number,
  ): Promise<ComposedSlaSourceRow[]> {
    try {
      if (entityType === 'lead_first_response') {
        const out = await this.db.query(COMPOSE_LEADS_SQL, [REVOPS_TENANT_ID, durationMinutes]);
        return out.rows as ComposedSlaSourceRow[];
      }
      if (entityType === 'handover_accept') {
        const out = await this.db.query(COMPOSE_HANDOVER_SQL, [REVOPS_TENANT_ID, durationMinutes]);
        return out.rows as ComposedSlaSourceRow[];
      }
      if (entityType === 'renewal_prep') {
        const out = await this.db.query(COMPOSE_RENEWAL_SQL, [REVOPS_TENANT_ID, durationMinutes]);
        return out.rows as ComposedSlaSourceRow[];
      }
      return [];
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async breachTrend7d(): Promise<Array<{ day: string; count: number }>> {
    try {
      const out = await this.db.query(
        `SELECT to_char(date_trunc('day', breached_at AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS count
           FROM crm_revops_sla_incidents
          WHERE tenant_id = $1
            AND breached_at IS NOT NULL
            AND breached_at >= now() - interval '7 days'
          GROUP BY 1
          ORDER BY 1`,
        [REVOPS_TENANT_ID],
      );
      return out.rows.map((row) => ({ day: String(row.day ?? ''), count: num(row.count) }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async countAutoReassignments(): Promise<number> {
    try {
      const out = await this.db.query(
        `SELECT COUNT(*)::int AS c
           FROM crm_lead_assignment_log al
          WHERE al.reason = 'revops_sla_auto_reassign'
            AND al.created_at >= now() - interval '7 days'`,
      );
      return num(out.rows[0]?.c);
    } catch {
      return 0;
    }
  }

  private async sendReminders(at: string): Promise<number> {
    try {
      const due = await this.db.query(
        `SELECT i.id, i.entity_type, i.entity_id
           FROM crm_revops_sla_incidents i
           JOIN crm_revops_sla_policies p ON p.id = i.policy_id
          WHERE i.tenant_id = $1
            AND i.status = 'warning'
            AND i.entity_type = 'lead_first_response'
            AND $2::timestamptz >= i.due_at - (p.warning_minutes || ' minutes')::interval + interval '3 minutes'
            AND NOT EXISTS (
              SELECT 1 FROM crm_lead_activities a
               WHERE a.lead_id = i.entity_id::bigint
                 AND a.content LIKE 'RevOps SLA reminder%'
            )`,
        [REVOPS_TENANT_ID, at],
      );
      let sent = 0;
      for (const row of due.rows) {
        const leadId = num(row.entity_id);
        if (leadId <= 0) continue;
        await this.db.query(
          `INSERT INTO crm_lead_activities (lead_id, activity_type, content, created_at, created_by)
           VALUES ($1, 'note', $2, now(), 'revops-sla-worker')`,
          [leadId, 'RevOps SLA reminder — lead first response sắp breach'],
        );
        sent += 1;
      }
      return sent;
    } catch (err) {
      if (isMissingRelation(err)) return 0;
      throw err;
    }
  }

  private async autoReassignBreached(at: string): Promise<number> {
    const rules = await this.db.query(
      `SELECT 1 FROM crm_revops_routing_rules
        WHERE tenant_id = $1 AND status = 'published'
        LIMIT 1`,
      [REVOPS_TENANT_ID],
    );
    if (!rules.rows[0]) return 0;

    const fallback = await this.db.query(
      `SELECT id FROM crm_staff WHERE active = true ORDER BY sort_order, name LIMIT 1`,
    );
    const fallbackId = num(fallback.rows[0]?.id);
    if (fallbackId <= 0) return 0;

    const candidates = await this.db.query(
      `SELECT i.id, i.entity_type, i.entity_id, i.owner_id
         FROM crm_revops_sla_incidents i
        WHERE i.tenant_id = $1
          AND i.status = 'breached'
          AND i.entity_type = 'lead_first_response'
          AND i.breached_at IS NOT NULL
          AND i.breached_at <= $2::timestamptz - interval '10 minutes'
          AND (i.owner_id IS NULL OR i.owner_id <> $3)`,
      [REVOPS_TENANT_ID, at, fallbackId],
    );

    let reassignments = 0;
    for (const row of candidates.rows) {
      const leadId = num(row.entity_id);
      if (leadId <= 0) continue;
      await this.db.query(
        `UPDATE crm_revops_sla_incidents SET owner_id = $2 WHERE id = $1::uuid`,
        [String(row.id), fallbackId],
      );
      try {
        await this.db.query(
          `INSERT INTO crm_lead_assignment_log
             (sqlite_lead_id, from_owner_id, to_owner_id, reason, assigned_by, created_at)
           VALUES ($1, $2, $3, 'revops_sla_auto_reassign', 'revops-sla-worker', now())`,
          [leadId, row.owner_id ?? null, fallbackId],
        );
        await this.db.query(`UPDATE crm_leads SET owner_id = $2 WHERE sqlite_lead_id = $1`, [
          leadId,
          fallbackId,
        ]);
      } catch {
        /* assignment log or leads table may be unavailable on partial schema */
      }
      reassignments += 1;
    }
    return reassignments;
  }

  private requireManage(caps: Array<{ section: string; action: string }>): void {
    if (
      !hasRevopsCommissionCap(caps, 'manage') &&
      !caps.some((c) => c.section === 'crm_revops' && c.action === 'manage')
    ) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_revops', action: 'manage' });
    }
  }
}
