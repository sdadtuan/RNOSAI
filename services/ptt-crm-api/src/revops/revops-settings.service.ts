import { Injectable } from '@nestjs/common';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AdminIntegrationsService } from '../admin-governance/admin-integrations.service';
import {
  REVOPS_ROLE_MATRIX,
  buildDataQualityIssues,
  buildIntegrationHealth,
  dataQualityTotal,
  formatAuditTimelineSummary,
  integrationHealthyCount,
} from './settings/revops-settings.util';
import { REVOPS_TENANT_ID, RevopsW3Repository, isMissingRelation } from './revops-w3.repository';
import type { RevopsSettingsDto } from './revops.types';

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class RevopsSettingsService {
  constructor(
    private readonly db: RevopsW3Repository,
    private readonly audit: AdminAuditService,
    private readonly integrations: AdminIntegrationsService,
  ) {}

  async getCenter(): Promise<RevopsSettingsDto> {
    const fetchedAt = new Date().toISOString();
    const [org, dataQuality, integrationList, auditEvents, rbacAudit] = await Promise.all([
      this.loadOrgSummary(),
      this.loadDataQualityCounts(),
      this.integrations.listIntegrations().catch(() => ({ integrations: [], summary: {} })),
      this.audit.listEvents({ q: 'crm_revops', limit: 20 }).catch(() => ({ events: [], has_more: false, next_cursor: null })),
      this.loadRevopsRbacAudit(),
    ]);

    const dataQualityIssues = buildDataQualityIssues(dataQuality);
    const integrations = buildIntegrationHealth(integrationList.integrations);
    const auditTimeline = [...rbacAudit, ...auditEvents.events]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 20)
      .map((event) => ({
        id: event.id,
        title: formatAuditTimelineSummary({
          actorEmail: event.actor_email,
          action: event.action,
          summary: event.summary,
          sectionId:
            typeof event.diff_json?.section_id === 'string'
              ? event.diff_json.section_id
              : undefined,
        }),
        detail: event.summary,
        createdAt: event.created_at,
        href: '/admin/audit?q=crm_revops',
      }));

    return {
      org,
      dataQuality: {
        totalIssues: dataQualityTotal(dataQualityIssues),
        issues: dataQualityIssues,
      },
      integrations: {
        healthyCount: integrationHealthyCount(integrations),
        totalCount: integrations.length,
        items: integrations,
      },
      roleMatrix: REVOPS_ROLE_MATRIX,
      auditTimeline,
      adminLinks: {
        users: '/admin/crm/org/users',
        departments: '/admin/crm/org/departments',
        teams: '/admin/crm/org/teams',
        permissions: '/admin/crm/permissions',
        audit: '/admin/audit?q=crm_revops',
        auditExport: '/admin/audit',
      },
      fetchedAt,
    };
  }

  private async loadOrgSummary(): Promise<RevopsSettingsDto['org']> {
    try {
      const [users, departments, teams, pending] = await Promise.all([
        this.db.query(`SELECT COUNT(*)::int AS count FROM staff_users WHERE active IS TRUE`),
        this.db.query(`SELECT COUNT(*)::int AS count FROM staff_departments WHERE active IS TRUE`),
        this.db.query(`SELECT COUNT(*)::int AS count FROM staff_teams WHERE active IS TRUE`),
        this.db.query(
          `SELECT COUNT(*)::int AS count
             FROM staff_users
            WHERE active IS TRUE
              AND expires_at IS NOT NULL
              AND expires_at <= NOW() + INTERVAL '14 days'`,
        ),
      ]);
      return {
        activeUsers: num(users.rows[0]?.count),
        businessUnits: num(departments.rows[0]?.count),
        teams: num(teams.rows[0]?.count),
        pendingLifecycle: num(pending.rows[0]?.count),
      };
    } catch (err) {
      if (isMissingRelation(err)) {
        return { activeUsers: null, businessUnits: null, teams: null, pendingLifecycle: null };
      }
      throw err;
    }
  }

  private async loadDataQualityCounts(): Promise<{
    dealsWithoutNextAction: number;
    accountsWithoutOwner: number;
    strategicWithoutPlan: number;
  }> {
    const empty = { dealsWithoutNextAction: 0, accountsWithoutOwner: 0, strategicWithoutPlan: 0 };
    try {
      const [deals, accounts, strategic] = await Promise.all([
        this.db.query(
          `SELECT COUNT(*)::int AS count
             FROM crm_leads l
             INNER JOIN crm_lead_presales ps ON ps.lead_id = l.sqlite_lead_id AND ps.status = 'active'
             LEFT JOIN LATERAL (
               SELECT a.next_action
                 FROM crm_lead_activities a
                WHERE a.lead_id = l.sqlite_lead_id
                ORDER BY a.created_at DESC NULLS LAST
                LIMIT 1
             ) act ON TRUE
            WHERE l.is_duplicate IS NOT TRUE
              AND lower(trim(COALESCE(l.status, ''))) NOT IN ('won', 'chot', 'lost', 'mat')
              AND (act.next_action IS NULL OR trim(act.next_action) = '')`,
        ),
        this.db.query(
          `SELECT COUNT(*)::int AS count
             FROM crm_am_account_ext e
            WHERE e.tenant_id = $1
              AND e.am_status IN ('active', 'onboarding', 'at_risk', 'renewing')
              AND (e.account_owner_staff_id IS NULL OR e.account_owner_staff_id <= 0)`,
          [REVOPS_TENANT_ID],
        ),
        this.db.query(
          `SELECT COUNT(*)::int AS count
             FROM crm_am_account_ext e
            WHERE e.tenant_id = $1
              AND e.am_status IN ('active', 'at_risk', 'renewing')
              AND upper(COALESCE(e.tier, '')) IN ('A', 'STRATEGIC', 'S')
              AND NOT EXISTS (
                SELECT 1
                  FROM crm_am_plans p
                 WHERE p.tenant_id = e.tenant_id
                   AND p.agency_client_id = e.agency_client_id
                   AND p.status IN ('open', 'in_progress')
              )`,
          [REVOPS_TENANT_ID],
        ),
      ]);
      return {
        dealsWithoutNextAction: num(deals.rows[0]?.count),
        accountsWithoutOwner: num(accounts.rows[0]?.count),
        strategicWithoutPlan: num(strategic.rows[0]?.count),
      };
    } catch (err) {
      if (isMissingRelation(err)) return empty;
      throw err;
    }
  }

  private async loadRevopsRbacAudit(): Promise<
    Array<{
      id: string;
      actor_email: string;
      action: string;
      summary: string;
      diff_json: Record<string, unknown>;
      created_at: string;
    }>
  > {
    try {
      const result = await this.db.query(
        `SELECT id::text,
                COALESCE(actor_email, '') AS actor_email,
                COALESCE(event_type, action, 'rbac') AS action,
                COALESCE(section_id, '') AS section_id,
                COALESCE(metadata_json, '{}'::jsonb) AS metadata_json,
                created_at::text
           FROM staff_rbac_audit_log
          WHERE section_id LIKE 'crm_revops%'
          ORDER BY created_at DESC
          LIMIT 20`,
      );
      return result.rows.map((row) => {
        const sectionId = String(row.section_id ?? '');
        const action = String(row.action ?? '');
        const actor = String(row.actor_email ?? '');
        return {
          id: `rbac_audit:${row.id}`,
          actor_email: actor,
          action,
          summary: `${actor || 'system'} · ${action}${sectionId ? ` · ${sectionId}` : ''}`,
          diff_json: { section_id: sectionId, ...(row.metadata_json as Record<string, unknown>) },
          created_at: String(row.created_at ?? ''),
        };
      });
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }
}
