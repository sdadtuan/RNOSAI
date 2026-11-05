import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  defaultLeadSlaSettingsPayload,
  mergeLeadSlaSettingsPayload,
  type LeadSlaSettingsPayload,
} from './lead-sla-settings.defaults';

export type LeadSlaSettingsRow = {
  id: number;
  tenant_id: string;
  payload: LeadSlaSettingsPayload;
  draft_payload: LeadSlaSettingsPayload | null;
  settings_version: number;
  is_active: boolean;
  published_at: string | null;
  updated_by: string;
  updated_at: string;
};

export type LeadSlaRevisionRow = {
  id: number;
  settings_id: number | null;
  settings_version: number;
  payload: LeadSlaSettingsPayload;
  note: string;
  actor: string;
  action: string;
  created_at: string;
};

export type LeadSlaPoolStaffRow = {
  id: number;
  name: string;
  email: string;
  job_title: string;
  active: boolean;
  accepts_leads: boolean;
  open_attempting: number;
};

function iso(value: unknown): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

@Injectable()
export class LeadSlaSettingsRepository implements OnModuleDestroy, OnModuleInit {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.schemaReady = null;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSchema();
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) this.schemaReady = this.bootstrapSchema();
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_lead_sla_settings (
        id                BIGSERIAL PRIMARY KEY,
        tenant_id         TEXT NOT NULL DEFAULT 'default',
        payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
        draft_payload     JSONB,
        settings_version  INT NOT NULL DEFAULT 1,
        is_active         BOOLEAN NOT NULL DEFAULT TRUE,
        published_at      TIMESTAMPTZ,
        updated_by        VARCHAR(160) NOT NULL DEFAULT '',
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT crm_lead_sla_settings_tenant_uq UNIQUE (tenant_id)
      );
      CREATE TABLE IF NOT EXISTS crm_lead_sla_settings_revisions (
        id                BIGSERIAL PRIMARY KEY,
        settings_id       BIGINT REFERENCES crm_lead_sla_settings(id) ON DELETE SET NULL,
        settings_version  INT NOT NULL,
        payload           JSONB NOT NULL,
        note              TEXT NOT NULL DEFAULT '',
        actor             VARCHAR(160) NOT NULL DEFAULT '',
        action            TEXT NOT NULL DEFAULT 'publish',
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_crm_lead_sla_revisions_created
        ON crm_lead_sla_settings_revisions (created_at DESC);
      ALTER TABLE crm_leads
        ADD COLUMN IF NOT EXISTS fr1_due_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS fr1_breached BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS hold_until TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS hold_reason TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS contact_status TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS call_attempt_count INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS attempts_since_assign INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_call_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_call_result TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS next_call_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS is_hot BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS reassign_count INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS sla_settings_version INT;
      ALTER TABLE crm_staff
        ADD COLUMN IF NOT EXISTS can_receive_leads BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    const defaults = defaultLeadSlaSettingsPayload(1);
    await this.db.query(
      `INSERT INTO crm_lead_sla_settings
         (tenant_id, payload, draft_payload, settings_version, is_active, published_at, updated_by)
       VALUES ('default', $1::jsonb, NULL, 1, TRUE, NOW(), 'seed')
       ON CONFLICT (tenant_id) DO NOTHING`,
      [JSON.stringify(defaults)],
    );

    await this.db.query(`
      UPDATE crm_staff s
      SET can_receive_leads = TRUE
      WHERE s.active IS TRUE
        AND s.can_receive_leads IS NOT TRUE
        AND (
          lower(COALESCE(s.job_title, '')) ~ '(am|account|sales|ae|kinh doanh|gdkd)'
          OR EXISTS (
            SELECT 1 FROM crm_b2b_project_staff ps
            WHERE ps.staff_id = s.id AND COALESCE(ps.assign_enabled, TRUE) IS TRUE
          )
        )
    `).catch(() => undefined);
  }

  private mapRow(row: Record<string, unknown>): LeadSlaSettingsRow {
    const version = Number(row.settings_version ?? 1);
    return {
      id: Number(row.id),
      tenant_id: String(row.tenant_id ?? 'default'),
      payload: mergeLeadSlaSettingsPayload(row.payload, version),
      draft_payload:
        row.draft_payload == null
          ? null
          : mergeLeadSlaSettingsPayload(row.draft_payload, version),
      settings_version: version,
      is_active: row.is_active !== false,
      published_at: iso(row.published_at),
      updated_by: String(row.updated_by ?? ''),
      updated_at: iso(row.updated_at) ?? new Date().toISOString(),
    };
  }

  async getActive(tenantId = 'default'): Promise<LeadSlaSettingsRow> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT * FROM crm_lead_sla_settings WHERE tenant_id = $1 LIMIT 1`,
      [tenantId],
    );
    if (!result.rows[0]) {
      const defaults = defaultLeadSlaSettingsPayload(1);
      const inserted = await this.db.query(
        `INSERT INTO crm_lead_sla_settings
           (tenant_id, payload, settings_version, is_active, published_at, updated_by)
         VALUES ($1, $2::jsonb, 1, TRUE, NOW(), 'seed')
         ON CONFLICT (tenant_id) DO UPDATE SET updated_at = crm_lead_sla_settings.updated_at
         RETURNING *`,
        [tenantId, JSON.stringify(defaults)],
      );
      return this.mapRow(inserted.rows[0] as Record<string, unknown>);
    }
    return this.mapRow(result.rows[0] as Record<string, unknown>);
  }

  async saveDraft(
    tenantId: string,
    draft: LeadSlaSettingsPayload,
    updatedBy: string,
  ): Promise<LeadSlaSettingsRow> {
    await this.ensureSchema();
    const result = await this.db.query(
      `UPDATE crm_lead_sla_settings
       SET draft_payload = $2::jsonb,
           updated_by = $3,
           updated_at = NOW()
       WHERE tenant_id = $1
       RETURNING *`,
      [tenantId, JSON.stringify(draft), updatedBy.slice(0, 160)],
    );
    if (!result.rows[0]) {
      await this.getActive(tenantId);
      return this.saveDraft(tenantId, draft, updatedBy);
    }
    return this.mapRow(result.rows[0] as Record<string, unknown>);
  }

  async publish(
    tenantId: string,
    payload: LeadSlaSettingsPayload,
    note: string,
    actor: string,
    action: string,
  ): Promise<{ row: LeadSlaSettingsRow; revision: LeadSlaRevisionRow }> {
    await this.ensureSchema();
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT * FROM crm_lead_sla_settings WHERE tenant_id = $1 FOR UPDATE`,
        [tenantId],
      );
      if (!current.rows[0]) {
        throw new NotFoundException({ error: 'settings_not_found' });
      }
      const nextVersion = Number(current.rows[0].settings_version ?? 0) + 1;
      const nextPayload: LeadSlaSettingsPayload = {
        ...payload,
        settings_version: nextVersion,
      };
      if (
        nextPayload.feature_flags.lead_sla_reassign_dry_run &&
        !nextPayload.feature_flags.dry_run_started_at
      ) {
        nextPayload.feature_flags.dry_run_started_at = new Date().toISOString();
      }

      const updated = await client.query(
        `UPDATE crm_lead_sla_settings
         SET payload = $2::jsonb,
             draft_payload = NULL,
             settings_version = $3,
             published_at = NOW(),
             updated_by = $4,
             updated_at = NOW(),
             is_active = TRUE
         WHERE tenant_id = $1
         RETURNING *`,
        [tenantId, JSON.stringify(nextPayload), nextVersion, actor.slice(0, 160)],
      );
      const settingsId = Number(updated.rows[0].id);
      const rev = await client.query(
        `INSERT INTO crm_lead_sla_settings_revisions
           (settings_id, settings_version, payload, note, actor, action)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6)
         RETURNING *`,
        [
          settingsId,
          nextVersion,
          JSON.stringify(nextPayload),
          note.slice(0, 2000),
          actor.slice(0, 160),
          action.slice(0, 40),
        ],
      );
      await client.query('COMMIT');
      return {
        row: this.mapRow(updated.rows[0] as Record<string, unknown>),
        revision: this.mapRevision(rev.rows[0] as Record<string, unknown>),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private mapRevision(row: Record<string, unknown>): LeadSlaRevisionRow {
    return {
      id: Number(row.id),
      settings_id: row.settings_id != null ? Number(row.settings_id) : null,
      settings_version: Number(row.settings_version),
      payload: mergeLeadSlaSettingsPayload(row.payload, Number(row.settings_version)),
      note: String(row.note ?? ''),
      actor: String(row.actor ?? ''),
      action: String(row.action ?? 'publish'),
      created_at: iso(row.created_at) ?? new Date().toISOString(),
    };
  }

  async listRevisions(
    tenantId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ items: LeadSlaRevisionRow[]; total: number }> {
    await this.ensureSchema();
    const settings = await this.getActive(tenantId);
    const count = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM crm_lead_sla_settings_revisions WHERE settings_id = $1`,
      [settings.id],
    );
    const result = await this.db.query(
      `SELECT * FROM crm_lead_sla_settings_revisions
       WHERE settings_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [settings.id, Math.min(Math.max(limit, 1), 200), Math.max(offset, 0)],
    );
    return {
      items: result.rows.map((r) => this.mapRevision(r as Record<string, unknown>)),
      total: Number(count.rows[0]?.n ?? 0),
    };
  }

  async getRevision(id: number): Promise<LeadSlaRevisionRow | null> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT * FROM crm_lead_sla_settings_revisions WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) return null;
    return this.mapRevision(result.rows[0] as Record<string, unknown>);
  }

  async listPoolStaff(): Promise<LeadSlaPoolStaffRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT s.id, s.name, COALESCE(s.email, '') AS email,
              COALESCE(s.job_title, '') AS job_title,
              s.active, COALESCE(s.can_receive_leads, FALSE) AS accepts_leads,
              COALESCE((
                SELECT COUNT(*)::int FROM crm_leads l
                WHERE l.owner_id = s.id
                  AND lower(COALESCE(l.contact_status, '')) IN ('new', 'attempting', 'meet_pending', 'callback_scheduled')
              ), 0) AS open_attempting
       FROM crm_staff s
       WHERE s.active IS TRUE
         AND (
           lower(COALESCE(s.job_title, '')) ~ '(am|account|sales|ae|kinh doanh|gdkd)'
           OR COALESCE(s.can_receive_leads, FALSE) IS TRUE
         )
       ORDER BY s.name ASC
       LIMIT 500`,
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ''),
      email: String(row.email ?? ''),
      job_title: String(row.job_title ?? ''),
      active: row.active === true || row.active === 1,
      accepts_leads: row.accepts_leads === true || row.accepts_leads === 1,
      open_attempting: Number(row.open_attempting ?? 0),
    }));
  }

  async setAcceptsLeads(staffId: number, accepts: boolean): Promise<LeadSlaPoolStaffRow | null> {
    await this.ensureSchema();
    const result = await this.db.query(
      `UPDATE crm_staff
       SET can_receive_leads = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, COALESCE(email, '') AS email,
                 COALESCE(job_title, '') AS job_title, active,
                 COALESCE(can_receive_leads, FALSE) AS accepts_leads`,
      [staffId, accepts],
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      id: Number(row.id),
      name: String(row.name ?? ''),
      email: String(row.email ?? ''),
      job_title: String(row.job_title ?? ''),
      active: row.active === true || row.active === 1,
      accepts_leads: row.accepts_leads === true || row.accepts_leads === 1,
      open_attempting: 0,
    };
  }

  /** LOCKED §15.5 / R3: new assign sets fr1_due_at; hold_until stays NULL until first phone log. */
  async applyFr1OnAssign(
    leadId: number,
    fr1DueAt: Date,
    _holdUntilIgnored: Date | null,
    settingsVersion: number,
    isHot: boolean,
  ): Promise<void> {
    await this.ensureSchema();
    await this.db.query(
      `UPDATE crm_leads
       SET fr1_due_at = $2,
           hold_until = NULL,
           hold_reason = '',
           hold_profile = '',
           assigned_at = NOW(),
           contact_status = 'new',
           attempts_since_assign = 0,
           first_call_at = NULL,
           fr1_breached = FALSE,
           last_call_result = '',
           is_hot = $3,
           sla_settings_version = $4,
           updated_at = NOW()
       WHERE sqlite_lead_id = $1`,
      [leadId, fr1DueAt.toISOString(), isHot, settingsVersion],
    );
  }

  async previewRecalcHold(
    leadIds: number[] | null,
    limit = 100,
  ): Promise<Array<{ lead_id: number; hold_until: string | null }>> {
    await this.ensureSchema();
    if (leadIds?.length) {
      const result = await this.db.query(
        `SELECT sqlite_lead_id AS lead_id, hold_until
         FROM crm_leads WHERE sqlite_lead_id = ANY($1::bigint[])`,
        [leadIds],
      );
      return result.rows.map((r) => ({
        lead_id: Number(r.lead_id),
        hold_until: iso(r.hold_until),
      }));
    }
    const result = await this.db.query(
      `SELECT sqlite_lead_id AS lead_id, hold_until
       FROM crm_leads
       WHERE hold_until IS NOT NULL
       ORDER BY hold_until ASC
       LIMIT $1`,
      [Math.min(Math.max(limit, 1), 500)],
    );
    return result.rows.map((r) => ({
      lead_id: Number(r.lead_id),
      hold_until: iso(r.hold_until),
    }));
  }
}
