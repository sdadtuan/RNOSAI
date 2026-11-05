import { ForbiddenException, Injectable } from '@nestjs/common';
import { hasRevopsCommissionCap } from './revops-scope.util';
import {
  REVOPS_ROUTING_DEFAULT_RULES,
  aggregateUtilizationPct,
  rankRoutingOwners,
  territoryLoadPct,
  type RevopsRoutingLeadContext,
  type RevopsRoutingStaffInput,
} from './routing/revops-routing.util';
import { REVOPS_TENANT_ID, RevopsW3Repository, isMissingRelation } from './revops-w3.repository';
import type {
  RevopsCreateRoutingRuleBody,
  RevopsCreateTerritoryBody,
  RevopsRoutingSimulateBody,
  RevopsRoutingSimulateResult,
  RevopsRoutingRuleDto,
  RevopsTerritoryCenterDto,
  RevopsTerritoryDto,
  RevopsUpdateTerritoryBody,
} from './revops.types';

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapTerritory(row: Record<string, unknown>): RevopsTerritoryDto {
  const openLeads = num(row.open_leads);
  const namedAccounts = num(row.named_accounts);
  const capacity = row.capacity == null ? null : num(row.capacity);
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    type: String(row.type ?? ''),
    parentId: row.parent_id ? String(row.parent_id) : null,
    parentName: row.parent_name ? String(row.parent_name) : null,
    teamLabel: row.team_label ? String(row.team_label) : null,
    capacity,
    openLeads,
    namedAccounts,
    loadPct: territoryLoadPct(openLeads, namedAccounts, capacity),
  };
}

function mapRule(row: Record<string, unknown>): RevopsRoutingRuleDto {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    priority: num(row.priority),
    conditionJson: row.condition_json ?? {},
    method: String(row.method ?? ''),
    fallback: row.fallback ? String(row.fallback) : null,
    status: String(row.status ?? ''),
  };
}

const TERRITORY_LOAD_SQL = `
  SELECT t.id, t.name, t.type, t.parent_id, p.name AS parent_name, t.team_label, t.capacity,
         COALESCE(loads.open_leads, 0)::int AS open_leads,
         COALESCE(loads.named_accounts, 0)::int AS named_accounts
    FROM crm_revops_territories t
    LEFT JOIN crm_revops_territories p ON p.id = t.parent_id
    LEFT JOIN LATERAL (
      SELECT
        (SELECT COUNT(*)::int
           FROM crm_leads l
          WHERE l.is_duplicate IS NOT TRUE
            AND l.owner_id IS NOT NULL
            AND lower(trim(l.status)) NOT IN ('won', 'lost', 'closed', 'chot', 'khong_chot', 'da_chot')
            AND (
              t.team_label IS NULL
              OR EXISTS (
                SELECT 1 FROM crm_staff cs
                 WHERE cs.id = l.owner_id
                   AND COALESCE(cs.department, '') ILIKE '%' || t.team_label || '%'
              )
            )
        ) AS open_leads,
        (SELECT COUNT(*)::int
           FROM crm_am_account_ext e
          WHERE e.account_owner_staff_id IS NOT NULL
            AND (
              t.team_label IS NULL
              OR EXISTS (
                SELECT 1 FROM crm_staff cs
                 WHERE cs.id = e.account_owner_staff_id
                   AND COALESCE(cs.department, '') ILIKE '%' || t.team_label || '%'
              )
            )
        ) AS named_accounts
    ) loads ON TRUE
   WHERE t.tenant_id = $1
   ORDER BY t.name`;

@Injectable()
export class RevopsRoutingService {
  constructor(private readonly db: RevopsW3Repository) {}

  async getCenter(): Promise<RevopsTerritoryCenterDto> {
    try {
      await this.ensureDefaultRules();
      const [territories, rules] = await Promise.all([
        this.db.query(TERRITORY_LOAD_SQL, [REVOPS_TENANT_ID]),
        this.db.query(
          `SELECT id, name, priority, condition_json, method, fallback, status
             FROM crm_revops_routing_rules
            WHERE tenant_id = $1
            ORDER BY priority ASC, name`,
          [REVOPS_TENANT_ID],
        ),
      ]);
      const territoryItems = territories.rows.map(mapTerritory);
      const activeTerritories = territoryItems.length;
      const coverageGaps = territoryItems.filter((t) => !t.teamLabel).length;
      const utilizationPct = aggregateUtilizationPct(territoryItems);
      return {
        kpis: { activeTerritories, coverageGaps, utilizationPct },
        territories: territoryItems,
        rules: rules.rows.map(mapRule),
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (isMissingRelation(err)) {
        return {
          kpis: { activeTerritories: 0, coverageGaps: 0, utilizationPct: null },
          territories: [],
          rules: [],
          fetchedAt: new Date().toISOString(),
        };
      }
      throw err;
    }
  }

  async createTerritory(
    caps: Array<{ section: string; action: string }>,
    body: RevopsCreateTerritoryBody,
  ): Promise<RevopsTerritoryDto> {
    this.requireManage(caps);
    const name = String(body.name ?? '').trim();
    const type = String(body.type ?? 'team').trim();
    if (!name) throw new ForbiddenException({ error: 'name_required' });
    const inserted = await this.db.query(
      `INSERT INTO crm_revops_territories (tenant_id, name, type, parent_id, team_label, capacity)
       VALUES ($1, $2, $3, $4::uuid, $5, $6)
       RETURNING id, name, type, parent_id, team_label, capacity`,
      [
        REVOPS_TENANT_ID,
        name,
        type,
        body.parent_id ?? null,
        body.team_label?.trim() || null,
        body.capacity ?? null,
      ],
    );
    const row = inserted.rows[0]!;
    return mapTerritory({ ...row, parent_name: null, open_leads: 0, named_accounts: 0 });
  }

  async updateTerritory(
    caps: Array<{ section: string; action: string }>,
    id: string,
    body: RevopsUpdateTerritoryBody,
  ): Promise<RevopsTerritoryDto> {
    this.requireManage(caps);
    const updated = await this.db.query(
      `UPDATE crm_revops_territories
          SET name = COALESCE($3, name),
              type = COALESCE($4, type),
              parent_id = CASE WHEN $5::text IS NULL THEN parent_id ELSE $5::uuid END,
              team_label = COALESCE($6, team_label),
              capacity = COALESCE($7, capacity)
        WHERE tenant_id = $1 AND id = $2::uuid
        RETURNING id, name, type, parent_id, team_label, capacity`,
      [
        REVOPS_TENANT_ID,
        id,
        body.name?.trim() || null,
        body.type?.trim() || null,
        body.parent_id === undefined ? null : body.parent_id,
        body.team_label?.trim() || null,
        body.capacity ?? null,
      ],
    );
    if (!updated.rows[0]) throw new ForbiddenException({ error: 'territory_not_found' });
    return mapTerritory({ ...updated.rows[0], parent_name: null, open_leads: 0, named_accounts: 0 });
  }

  async deleteTerritory(
    caps: Array<{ section: string; action: string }>,
    id: string,
  ): Promise<{ ok: true }> {
    this.requireManage(caps);
    const deleted = await this.db.query(
      `DELETE FROM crm_revops_territories WHERE tenant_id = $1 AND id = $2::uuid RETURNING id`,
      [REVOPS_TENANT_ID, id],
    );
    if (!deleted.rows[0]) throw new ForbiddenException({ error: 'territory_not_found' });
    return { ok: true };
  }

  async createRule(
    caps: Array<{ section: string; action: string }>,
    body: RevopsCreateRoutingRuleBody,
  ): Promise<RevopsRoutingRuleDto> {
    this.requireManage(caps);
    const name = String(body.name ?? '').trim();
    if (!name) throw new ForbiddenException({ error: 'name_required' });
    const method = this.normalizeMethod(String(body.method ?? 'round_robin'));
    const inserted = await this.db.query(
      `INSERT INTO crm_revops_routing_rules (
         tenant_id, name, priority, condition_json, method, fallback, status
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'draft')
       RETURNING id, name, priority, condition_json, method, fallback, status`,
      [
        REVOPS_TENANT_ID,
        name,
        num(body.priority) || 100,
        JSON.stringify(body.condition_json ?? {}),
        method,
        body.fallback?.trim() || null,
      ],
    );
    return mapRule(inserted.rows[0]!);
  }

  async publishRule(
    caps: Array<{ section: string; action: string }>,
    id: string,
  ): Promise<RevopsRoutingRuleDto> {
    this.requireManage(caps);
    const updated = await this.db.query(
      `UPDATE crm_revops_routing_rules
          SET status = 'published'
        WHERE tenant_id = $1 AND id = $2::uuid
        RETURNING id, name, priority, condition_json, method, fallback, status`,
      [REVOPS_TENANT_ID, id],
    );
    if (!updated.rows[0]) throw new ForbiddenException({ error: 'rule_not_found' });
    return mapRule(updated.rows[0]);
  }

  async simulate(body: RevopsRoutingSimulateBody): Promise<RevopsRoutingSimulateResult> {
    try {
      await this.ensureDefaultRules();
      const [rulesOut, staffOut, leadCtx] = await Promise.all([
        this.db.query(
          `SELECT id, name, priority, condition_json, method, status
             FROM crm_revops_routing_rules
            WHERE tenant_id = $1
            ORDER BY priority ASC`,
          [REVOPS_TENANT_ID],
        ),
        this.loadStaffPool(),
        this.loadLeadContext(body.lead_id),
      ]);
      const rules = rulesOut.rows.map((row) => ({
        id: String(row.id ?? ''),
        name: String(row.name ?? ''),
        priority: num(row.priority),
        method: String(row.method ?? ''),
        conditionJson: (row.condition_json ?? {}) as Record<string, unknown>,
        status: String(row.status ?? ''),
      }));
      const rankedOwners = rankRoutingOwners(leadCtx, rules, staffOut);
      return { leadId: leadCtx.leadId, rankedOwners };
    } catch (err) {
      if (isMissingRelation(err)) return { leadId: body.lead_id ?? null, rankedOwners: [] };
      throw err;
    }
  }

  private async ensureDefaultRules(): Promise<void> {
    for (const def of REVOPS_ROUTING_DEFAULT_RULES) {
      const existing = await this.db.query(
        `SELECT id FROM crm_revops_routing_rules
          WHERE tenant_id = $1 AND name = $2
          LIMIT 1`,
        [REVOPS_TENANT_ID, def.name],
      );
      if (existing.rows[0]) continue;
      await this.db.query(
        `INSERT INTO crm_revops_routing_rules (
           tenant_id, name, priority, condition_json, method, fallback, status
         ) VALUES ($1, $2, $3, $4::jsonb, $5, NULL, 'published')`,
        [
          REVOPS_TENANT_ID,
          def.name,
          def.priority,
          JSON.stringify(def.conditionJson),
          def.method,
        ],
      );
    }
  }

  private async loadStaffPool(): Promise<RevopsRoutingStaffInput[]> {
    try {
      const out = await this.db.query(
        `SELECT cs.id, cs.name, cs.department,
                COALESCE(leads.c, 0)::int AS open_leads,
                COALESCE(accounts.c, 0)::int AS named_accounts
           FROM crm_staff cs
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS c FROM crm_leads l
              WHERE l.owner_id = cs.id
                AND l.is_duplicate IS NOT TRUE
                AND lower(trim(l.status)) NOT IN ('won', 'lost', 'closed', 'chot', 'khong_chot', 'da_chot')
           ) leads ON TRUE
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS c FROM crm_am_account_ext e
              WHERE e.account_owner_staff_id = cs.id
           ) accounts ON TRUE
          WHERE cs.active = true
          ORDER BY cs.sort_order, cs.name
          LIMIT 50`,
      );
      return out.rows.map((row) => ({
        staffId: num(row.id),
        name: String(row.name ?? ''),
        department: row.department ? String(row.department) : null,
        openLeads: num(row.open_leads),
        namedAccounts: num(row.named_accounts),
      }));
    } catch (err) {
      if (isMissingRelation(err)) return [];
      throw err;
    }
  }

  private async loadLeadContext(leadId?: number): Promise<RevopsRoutingLeadContext> {
    if (!leadId || leadId <= 0) {
      return { leadId: null, agencyClientId: null, industry: null, accountOwnerStaffId: null };
    }
    try {
      const lead = await this.db.query(
        `SELECT l.sqlite_lead_id, l.agency_client_id::text AS agency_client_id,
                COALESCE(l.meta_json->>'industry', l.meta_json->>'nganh', '') AS industry
           FROM crm_leads l
          WHERE l.sqlite_lead_id = $1
          LIMIT 1`,
        [leadId],
      );
      const row = lead.rows[0];
      if (!row) {
        return { leadId, agencyClientId: null, industry: null, accountOwnerStaffId: null };
      }
      const agencyClientId = row.agency_client_id ? String(row.agency_client_id) : null;
      let accountOwnerStaffId: number | null = null;
      if (agencyClientId) {
        const account = await this.db.query(
          `SELECT account_owner_staff_id FROM crm_am_account_ext
            WHERE agency_client_id = $1::uuid
            LIMIT 1`,
          [agencyClientId],
        );
        accountOwnerStaffId =
          account.rows[0]?.account_owner_staff_id == null
            ? null
            : num(account.rows[0].account_owner_staff_id);
      }
      return {
        leadId,
        agencyClientId,
        industry: row.industry ? String(row.industry) : null,
        accountOwnerStaffId,
      };
    } catch (err) {
      if (isMissingRelation(err)) return { leadId, agencyClientId: null, industry: null, accountOwnerStaffId: null };
      throw err;
    }
  }

  private normalizeMethod(raw: string): string {
    if (raw === 'capacity_balance') return 'capacity';
    if (raw === 'territory_match') return 'territory';
    if (['round_robin', 'named_account', 'territory', 'capacity'].includes(raw)) return raw;
    return 'round_robin';
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
