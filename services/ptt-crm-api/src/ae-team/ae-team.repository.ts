import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { buildB2bProspectListFilter } from '../leads-funnel/lead-flow-list-filter.util';

export interface AeMemberRow {
  staff_id: number;
  name: string;
  accepting: boolean;
  quota_vnd: number | null;
}

export interface AeLeadRow {
  id: number;
  owner_id: number;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  source: string;
  channel: string;
  client_id: string | null;
  b2b_project_id: string | null;
  received_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_call_at: string | null;
  next_call_at: string | null;
  first_call_at: string | null;
  call_attempt_count: number;
  last_call_result: string;
  meta_json: Record<string, unknown>;
}

@Injectable()
export class AeTeamRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private ready: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async ensure(): Promise<void> {
    if (!this.ready) {
      this.ready = this.createTables().catch((err: unknown) => {
        this.ready = null;
        throw err;
      });
    }
    await this.ready;
  }

  private async createTables(): Promise<void> {
    const statements = [
      `CREATE TABLE IF NOT EXISTS crm_ae_intake (
        staff_id INTEGER PRIMARY KEY,
        accepting BOOLEAN NOT NULL DEFAULT TRUE,
        note TEXT NOT NULL DEFAULT '',
        updated_by INTEGER,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS crm_ae_targets (
        staff_id INTEGER NOT NULL,
        month CHAR(7) NOT NULL,
        quota_vnd BIGINT,
        PRIMARY KEY (staff_id, month)
      )`,
      `CREATE TABLE IF NOT EXISTS crm_ae_team_daily (
        staff_id INTEGER NOT NULL,
        day DATE NOT NULL,
        counts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        PRIMARY KEY (staff_id, day)
      )`,
      `CREATE TABLE IF NOT EXISTS crm_ae_instruction_reads (
        activity_id BIGINT NOT NULL,
        staff_id INTEGER NOT NULL,
        read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (activity_id, staff_id)
      )`,
      `CREATE TABLE IF NOT EXISTS crm_ae_team_alerts (
        id BIGSERIAL PRIMARY KEY,
        rule_code TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        level TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        owner_staff_id INTEGER,
        dedupe_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        acknowledged_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        resolved_by TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS crm_ae_team_alerts_active_dedupe
        ON crm_ae_team_alerts (dedupe_key)
        WHERE status <> 'resolved'`,
    ];
    for (const sql of statements) {
      await this.db.query(sql);
    }
    try {
      await this.db.query(
        `INSERT INTO schema_migrations (version, description)
         SELECT '20261013_ae_team_g1', 'AE team intake targets snapshot'
         WHERE NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '20261013_ae_team_g1')`,
      );
      await this.db.query(
        `INSERT INTO schema_migrations (version, description)
         SELECT '20261013_ae_team_g3', 'AE team alerts'
         WHERE NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '20261013_ae_team_g3')`,
      );
    } catch {
      /* The tables are the source of truth if the migration log is unavailable. */
    }
  }

  async leadTeamIds(userId: string): Promise<number[]> {
    const result = await this.db.query(
      `SELECT team_id FROM staff_user_teams WHERE user_id = $1 AND team_role = 'lead'`,
      [userId],
    );
    return result.rows.map((row) => Number(row.team_id)).filter((id) => id > 0);
  }

  async memberTeamIds(userId: string): Promise<number[]> {
    const result = await this.db.query(
      `SELECT team_id FROM staff_user_teams WHERE user_id = $1`,
      [userId],
    );
    return result.rows.map((row) => Number(row.team_id)).filter((id) => id > 0);
  }

  async listMembers(input: { viewAll: boolean; teamIds: number[]; month: string }): Promise<AeMemberRow[]> {
    const result = await this.db.query(
      `SELECT DISTINCT s.id AS staff_id,
              COALESCE(NULLIF(trim(s.name), ''), u.email) AS name,
              COALESCE(i.accepting, TRUE) AS accepting,
              t.quota_vnd
       FROM staff_user_teams sut
       JOIN staff_users u ON u.id = sut.user_id
       JOIN crm_positions p ON p.id = u.position_id
       JOIN crm_staff s ON s.active IS TRUE AND lower(trim(s.email)) = lower(trim(u.email))
       LEFT JOIN crm_ae_intake i ON i.staff_id = s.id
       LEFT JOIN crm_ae_targets t ON t.staff_id = s.id AND t.month = $3
       WHERE ($1::boolean IS TRUE OR sut.team_id = ANY($2::bigint[]))
         AND (
           lower(replace(p.code, ' ', '')) = 'ae'
           OR lower(p.code) LIKE 'ae-%'
           OR lower(p.code) LIKE 'ae_%'
         )
       ORDER BY name`,
      [input.viewAll, input.teamIds, input.month],
    );
    return result.rows.map((row) => ({
      staff_id: Number(row.staff_id),
      name: String(row.name ?? ''),
      accepting: row.accepting !== false,
      quota_vnd: row.quota_vnd == null ? null : Number(row.quota_vnd),
    }));
  }

  async listLeads(ownerIds: number[]): Promise<AeLeadRow[]> {
    if (!ownerIds.length) return [];
    const flow = buildB2bProspectListFilter('postgres', 'l');
    const result = await this.db.query(
      `SELECT l.sqlite_lead_id AS id, l.owner_id, COALESCE(l.full_name, '') AS full_name,
              COALESCE(l.phone, '') AS phone, COALESCE(l.email, '') AS email,
              COALESCE(l.status, '') AS status, COALESCE(l.source, '') AS source,
              COALESCE(l.channel, '') AS channel, l.client_id, l.b2b_project_id::text AS b2b_project_id,
              l.received_at::text AS received_at, l.created_at::text AS created_at, l.updated_at::text AS updated_at,
              l.last_call_at::text AS last_call_at, l.next_call_at::text AS next_call_at,
              l.call_attempt_count, COALESCE(l.last_call_result, '') AS last_call_result,
              COALESCE(l.meta_json, '{}'::jsonb) AS meta_json,
              (SELECT MIN(a.created_at)::text FROM crm_lead_activities a
                WHERE a.lead_id = l.sqlite_lead_id AND a.activity_type = 'call') AS first_call_at
       FROM crm_leads l
       WHERE l.owner_id = ANY($1::bigint[])
         AND l.is_duplicate IS NOT TRUE
         AND ${flow}`,
      [ownerIds],
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      owner_id: Number(row.owner_id),
      full_name: String(row.full_name ?? ''),
      phone: String(row.phone ?? ''),
      email: String(row.email ?? ''),
      status: String(row.status ?? ''),
      source: String(row.source ?? ''),
      channel: String(row.channel ?? ''),
      client_id: row.client_id == null ? null : String(row.client_id),
      b2b_project_id: row.b2b_project_id == null ? null : String(row.b2b_project_id),
      received_at: row.received_at == null ? null : String(row.received_at),
      created_at: row.created_at == null ? null : String(row.created_at),
      updated_at: row.updated_at == null ? null : String(row.updated_at),
      last_call_at: row.last_call_at == null ? null : String(row.last_call_at),
      next_call_at: row.next_call_at == null ? null : String(row.next_call_at),
      first_call_at: row.first_call_at == null ? null : String(row.first_call_at),
      call_attempt_count: Number(row.call_attempt_count ?? 0),
      last_call_result: String(row.last_call_result ?? ''),
      meta_json: row.meta_json && typeof row.meta_json === 'object' ? row.meta_json : {},
    }));
  }

  async listCalls(ownerIds: number[], from: Date, to: Date): Promise<Array<{ owner_id: number; at: string; content: string }>> {
    if (!ownerIds.length) return [];
    const result = await this.db.query(
      `SELECT l.owner_id, a.created_at::text AS at, COALESCE(a.content, '') AS content
       FROM crm_lead_activities a
       JOIN crm_leads l ON l.sqlite_lead_id = a.lead_id
       WHERE a.activity_type = 'call'
         AND l.owner_id = ANY($1::bigint[])
         AND a.created_at >= $2 AND a.created_at <= $3`,
      [ownerIds, from.toISOString(), to.toISOString()],
    );
    return result.rows.map((row) => ({
      owner_id: Number(row.owner_id),
      at: String(row.at),
      content: String(row.content ?? ''),
    }));
  }

  async timeline(ownerId: number): Promise<{
    activities: Array<{ id: number; lead_id: number; activity_type: string; content: string; created_at: string; created_by: string }>;
    assignments: Array<{ id: string; lead_id: number; from_owner_id: number | null; to_owner_id: number | null; reason: string; assigned_by: string; created_at: string }>;
    instructions: Array<{ id: number; lead_id: number; content: string; created_at: string; read_at: string | null }>;
  }> {
    const activities = await this.db.query(
      `SELECT a.id, a.lead_id, a.activity_type, COALESCE(a.content, '') AS content,
              a.created_at::text AS created_at, COALESCE(a.created_by, '') AS created_by
       FROM crm_lead_activities a
       JOIN crm_leads l ON l.sqlite_lead_id = a.lead_id
       WHERE l.owner_id = $1 AND l.is_duplicate IS NOT TRUE
       ORDER BY a.created_at DESC
       LIMIT 40`,
      [ownerId],
    );
    const assignments = await this.db.query(
      `SELECT al.id::text AS id, al.sqlite_lead_id AS lead_id, al.from_owner_id, al.to_owner_id,
              COALESCE(al.reason, '') AS reason, COALESCE(al.assigned_by, '') AS assigned_by,
              al.created_at::text AS created_at
       FROM crm_lead_assignment_log al
       JOIN crm_leads l ON l.sqlite_lead_id = al.sqlite_lead_id
       WHERE l.owner_id = $1 AND l.is_duplicate IS NOT TRUE
       ORDER BY al.created_at DESC
       LIMIT 40`,
      [ownerId],
    );
    const instructions = await this.db.query(
      `SELECT a.id, a.lead_id, COALESCE(a.content, '') AS content, a.created_at::text AS created_at,
              r.read_at::text AS read_at
       FROM crm_lead_activities a
       JOIN crm_leads l ON l.sqlite_lead_id = a.lead_id
       LEFT JOIN crm_ae_instruction_reads r ON r.activity_id = a.id AND r.staff_id = l.owner_id
       WHERE l.owner_id = $1 AND a.activity_type = 'am_instruction' AND l.is_duplicate IS NOT TRUE
       ORDER BY a.created_at DESC
       LIMIT 20`,
      [ownerId],
    );
    return {
      activities: activities.rows.map((row) => ({
        id: Number(row.id),
        lead_id: Number(row.lead_id),
        activity_type: String(row.activity_type ?? ''),
        content: String(row.content ?? ''),
        created_at: String(row.created_at ?? ''),
        created_by: String(row.created_by ?? ''),
      })),
      assignments: assignments.rows.map((row) => ({
        id: String(row.id),
        lead_id: Number(row.lead_id),
        from_owner_id: row.from_owner_id == null ? null : Number(row.from_owner_id),
        to_owner_id: row.to_owner_id == null ? null : Number(row.to_owner_id),
        reason: String(row.reason ?? ''),
        assigned_by: String(row.assigned_by ?? ''),
        created_at: String(row.created_at ?? ''),
      })),
      instructions: instructions.rows.map((row) => ({
        id: Number(row.id),
        lead_id: Number(row.lead_id),
        content: String(row.content ?? ''),
        created_at: String(row.created_at ?? ''),
        read_at: row.read_at == null ? null : String(row.read_at),
      })),
    };
  }

  async listCallContents(leadIds: number[]): Promise<Map<number, string[]>> {
    const grouped = new Map<number, string[]>();
    if (!leadIds.length) return grouped;
    const result = await this.db.query(
      `SELECT lead_id, content
       FROM (
         SELECT a.lead_id, COALESCE(a.content, '') AS content,
                row_number() OVER (PARTITION BY a.lead_id ORDER BY a.created_at DESC) AS n
         FROM crm_lead_activities a
         WHERE a.activity_type = 'call' AND a.lead_id = ANY($1::bigint[])
       ) recent
       WHERE n <= 20
       ORDER BY lead_id, n DESC`,
      [leadIds],
    );
    for (const row of result.rows) {
      const id = Number(row.lead_id);
      const list = grouped.get(id) ?? [];
      list.push(String(row.content ?? ''));
      grouped.set(id, list);
    }
    return grouped;
  }

  async getLeadForMove(leadId: number): Promise<{
    id: number;
    owner_id: number;
    full_name: string;
    b2b_project_id: string | null;
    lead_flow_kind: string | null;
  } | null> {
    const result = await this.db.query(
      `SELECT sqlite_lead_id AS id, owner_id, COALESCE(full_name, '') AS full_name,
              b2b_project_id::text AS b2b_project_id,
              NULLIF(meta_json->>'lead_flow_kind', '') AS lead_flow_kind
       FROM crm_leads
       WHERE sqlite_lead_id = $1 AND is_duplicate IS NOT TRUE`,
      [leadId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const projectId = row.b2b_project_id == null ? null : String(row.b2b_project_id);
    return {
      id: Number(row.id),
      owner_id: Number(row.owner_id),
      full_name: String(row.full_name ?? ''),
      b2b_project_id: projectId,
      lead_flow_kind: row.lead_flow_kind ? String(row.lead_flow_kind) : projectId ? 'b2b_prospect' : null,
    };
  }

  async updateOwner(leadId: number, toOwnerId: number): Promise<void> {
    await this.db.query(
      `UPDATE crm_leads SET owner_id = $2, updated_at = NOW() WHERE sqlite_lead_id = $1`,
      [leadId, toOwnerId],
    );
  }

  async insertAssignmentLog(row: {
    lead_id: number;
    from_owner_id: number | null;
    to_owner_id: number;
    reason: string;
    assigned_by: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_lead_assignment_log
         (sqlite_lead_id, from_owner_id, to_owner_id, reason, assigned_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.lead_id, row.from_owner_id, row.to_owner_id, row.reason, row.assigned_by],
    );
  }

  async insertActivity(leadId: number, activityType: string, content: string, actor: string): Promise<number | null> {
    const result = await this.db.query(
      `INSERT INTO crm_lead_activities (
         lead_id, activity_type, content, result, next_action, created_at, created_by, lead_status_at_log
       )
       SELECT $1, $2, $3, '', '', NOW(), $4, COALESCE(status, '')
       FROM crm_leads
       WHERE sqlite_lead_id = $1
       RETURNING id`,
      [leadId, activityType, content.slice(0, 8000), actor.slice(0, 120)],
    );
    const id = result.rows[0]?.id;
    return id == null ? null : Number(id);
  }

  async staffUserId(staffId: number): Promise<string | null> {
    const result = await this.db.query(
      `SELECT u.id::text AS user_id
       FROM crm_staff s
       JOIN staff_users u ON lower(trim(u.email)) = lower(trim(s.email))
       WHERE s.id = $1
       LIMIT 1`,
      [staffId],
    );
    return result.rows[0]?.user_id ? String(result.rows[0].user_id) : null;
  }

  async setIntake(staffId: number, accepting: boolean, note: string, updatedBy: number | null): Promise<void> {
    await this.ensure();
    await this.db.query(
      `INSERT INTO crm_ae_intake (staff_id, accepting, note, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (staff_id) DO UPDATE SET
         accepting = EXCLUDED.accepting,
         note = EXCLUDED.note,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [staffId, accepting, note.slice(0, 500), updatedBy],
    );
  }

  async assignEnabledStaffIds(projectId: string): Promise<Set<number>> {
    const result = await this.db.query(
      `SELECT staff_id FROM crm_b2b_project_staff
       WHERE project_id = $1::uuid AND assign_enabled IS TRUE`,
      [projectId],
    );
    return new Set(result.rows.map((row) => Number(row.staff_id)).filter((id) => id > 0));
  }

  async instructionOwner(activityId: number): Promise<{ id: number; owner_id: number } | null> {
    const result = await this.db.query(
      `SELECT a.id, l.owner_id
       FROM crm_lead_activities a
       JOIN crm_leads l ON l.sqlite_lead_id = a.lead_id
       WHERE a.id = $1 AND a.activity_type = 'am_instruction'`,
      [activityId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { id: Number(row.id), owner_id: Number(row.owner_id) };
  }

  async markInstructionRead(activityId: number, staffId: number): Promise<void> {
    await this.ensure();
    await this.db.query(
      `INSERT INTO crm_ae_instruction_reads (activity_id, staff_id, read_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (activity_id, staff_id) DO UPDATE SET read_at = NOW()`,
      [activityId, staffId],
    );
  }

  async listAlertsForTick(since: Date): Promise<Array<{
    id: number;
    ruleCode: string;
    level: 'info' | 'yellow' | 'red' | 'esc';
    status: 'open' | 'acknowledged' | 'resolved';
    dedupeKey: string;
    createdAt: string;
    ownerStaffId: number;
    targetType: string;
    targetId: string;
  }>> {
    await this.ensure();
    const result = await this.db.query(
      `SELECT id, rule_code, target_type, target_id, level, status, owner_staff_id,
              dedupe_key, created_at::text AS created_at
       FROM crm_ae_team_alerts
       WHERE status <> 'resolved' OR created_at >= $1`,
      [since.toISOString()],
    );
    return result.rows.map((row) => this.mapAlert(row));
  }

  async listOpenAlerts(ownerIds: number[]) {
    await this.ensure();
    if (!ownerIds.length) return [];
    const result = await this.db.query(
      `SELECT id, rule_code, target_type, target_id, level, status, owner_staff_id,
              dedupe_key, created_at::text AS created_at
       FROM crm_ae_team_alerts
       WHERE status <> 'resolved' AND owner_staff_id = ANY($1::bigint[])
       ORDER BY created_at DESC`,
      [ownerIds],
    );
    return result.rows.map((row) => this.mapAlert(row));
  }

  async getAlert(id: number) {
    await this.ensure();
    const result = await this.db.query(
      `SELECT id, rule_code, target_type, target_id, level, status, owner_staff_id,
              dedupe_key, created_at::text AS created_at
       FROM crm_ae_team_alerts WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.mapAlert(result.rows[0]) : null;
  }

  async insertAlert(row: {
    ruleCode: string;
    targetType: string;
    targetId: string;
    level: string;
    ownerStaffId: number;
    dedupeKey: string;
  }): Promise<number | null> {
    await this.ensure();
    const result = await this.db.query(
      `INSERT INTO crm_ae_team_alerts
         (rule_code, target_type, target_id, level, status, owner_staff_id, dedupe_key)
       VALUES ($1, $2, $3, $4, 'open', $5, $6)
       ON CONFLICT (dedupe_key) WHERE status <> 'resolved' DO NOTHING
       RETURNING id`,
      [row.ruleCode, row.targetType, row.targetId, row.level, row.ownerStaffId, row.dedupeKey],
    );
    const id = result.rows[0]?.id;
    return id == null ? null : Number(id);
  }

  async setAlertLevel(id: number, level: string): Promise<void> {
    await this.db.query(
      `UPDATE crm_ae_team_alerts SET level = $2 WHERE id = $1 AND status = 'open'`,
      [id, level],
    );
  }

  async resolveAlerts(ids: number[], resolvedBy: string): Promise<void> {
    if (!ids.length) return;
    await this.db.query(
      `UPDATE crm_ae_team_alerts
       SET status = 'resolved', resolved_at = NOW(), resolved_by = $2
       WHERE id = ANY($1::bigint[]) AND status <> 'resolved'`,
      [ids, resolvedBy.slice(0, 120)],
    );
  }

  async acknowledgeAlert(id: number): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE crm_ae_team_alerts
       SET status = 'acknowledged', acknowledged_at = NOW()
       WHERE id = $1 AND status = 'open'`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async teamLeadUserIds(staffIds: number[]): Promise<Map<number, string[]>> {
    const grouped = new Map<number, string[]>();
    if (!staffIds.length) return grouped;
    const result = await this.db.query(
      `SELECT ae.id AS staff_id, lead_user.id::text AS user_id
       FROM crm_staff ae
       JOIN staff_users ae_user ON lower(trim(ae_user.email)) = lower(trim(ae.email))
       JOIN staff_user_teams ae_team ON ae_team.user_id = ae_user.id
       JOIN staff_user_teams lead_team
         ON lead_team.team_id = ae_team.team_id AND lead_team.team_role = 'lead'
       JOIN staff_users lead_user ON lead_user.id = lead_team.user_id
       WHERE ae.id = ANY($1::bigint[])`,
      [staffIds],
    );
    for (const row of result.rows) {
      const staffId = Number(row.staff_id);
      const list = grouped.get(staffId) ?? [];
      const userId = String(row.user_id ?? '');
      if (userId && !list.includes(userId)) list.push(userId);
      grouped.set(staffId, list);
    }
    return grouped;
  }

  async viewAllUserIds(): Promise<string[]> {
    try {
      const result = await this.db.query(
        `SELECT DISTINCT u.id::text AS user_id
         FROM staff_users u
         JOIN staff_section_permissions p ON p.position_id = u.position_id
         WHERE u.active IS TRUE AND p.section_id = 'crm_ae_team' AND p.action = 'view_all'`,
      );
      return result.rows.map((row) => String(row.user_id)).filter(Boolean);
    } catch {
      return [];
    }
  }

  private mapAlert(row: Record<string, unknown>) {
    return {
      id: Number(row.id),
      ruleCode: String(row.rule_code ?? ''),
      level: String(row.level ?? 'info') as 'info' | 'yellow' | 'red' | 'esc',
      status: String(row.status ?? 'open') as 'open' | 'acknowledged' | 'resolved',
      dedupeKey: String(row.dedupe_key ?? ''),
      createdAt: String(row.created_at ?? ''),
      ownerStaffId: Number(row.owner_staff_id ?? 0),
      targetType: String(row.target_type ?? ''),
      targetId: String(row.target_id ?? ''),
    };
  }
}
