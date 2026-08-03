import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  CONTACT_OK_CARE_STATUS,
  computeB2Complete,
  LeadStatusGateError,
  validateLeadStatusChange,
} from './lead-status-gate.util';
import { PatchLeadV1Body } from './leads.types';

export interface LeadStatusGatePatchOptions {
  allowStatusOverride?: boolean;
}

@Injectable()
export class LeadStatusGateService implements OnModuleDestroy {
  private pool: Pool | null = null;
  private sqlite: DatabaseSync | null = null;

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
    if (this.sqlite) {
      this.sqlite.close();
      this.sqlite = null;
    }
  }

  private get sqliteDb(): DatabaseSync {
    if (!this.sqlite) {
      this.sqlite = new DatabaseSync(this.config.sqlitePath);
      this.sqlite.exec('PRAGMA foreign_keys = ON');
    }
    return this.sqlite;
  }

  isEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_LEAD_STATUS_GATE ?? '1').trim().toLowerCase(),
    );
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
    const row = await this.fetchLeadRow(leadId);
    if (!row) {
      throw new LeadStatusGateError('lead_not_found', 'Không tìm thấy lead.');
    }

    const [hasContactOkReport, hasOutreachActivity] = await Promise.all([
      this.hasContactOkReport(leadId),
      this.hasOutreachActivity(leadId),
    ]);

    const b2Complete = computeB2Complete({
      careStageCurrent: row.care_stage_current,
      careStagesDoneJson: row.care_stages_done_json,
      hasContactOkReport,
    });

    const needsCleanup = this.leadNeedsCleanup(row.full_name, row.phone);

    return {
      oldStatus: String(row.status ?? 'moi'),
      newStatus: String(body.status ?? '').trim(),
      auditNote: String(body.audit_note ?? '').trim(),
      allowOverride: Boolean(opts.allowStatusOverride && body.allow_status_override),
      overrideReason: String(body.status_override_reason ?? body.audit_note ?? '').trim(),
      b2Complete,
      hasOutreachActivity,
      needsCleanup,
    };
  }

  private async fetchLeadRow(leadId: number): Promise<{
    status: string | null;
    full_name: string | null;
    phone: string | null;
    care_stage_current: string | null;
    care_stages_done_json: string | null;
  } | null> {
    if (this.config.crmLeadsLegacyPg) {
      const result = await this.db.query(
        `SELECT status, full_name, phone,
                COALESCE(care_stage_current, 'first_contact') AS care_stage_current,
                COALESCE(care_stages_done_json, '{}'::jsonb)::text AS care_stages_done_json
         FROM crm_leads
         WHERE sqlite_lead_id = $1
         LIMIT 1`,
        [leadId],
      );
      return (result.rows[0] as typeof result.rows[0] | undefined) ?? null;
    }

    const row = this.sqliteDb
      .prepare(
        `SELECT status, full_name, phone,
                COALESCE(care_stage_current, 'first_contact') AS care_stage_current,
                COALESCE(care_stages_done_json, '{}') AS care_stages_done_json
         FROM crm_leads WHERE id = ? LIMIT 1`,
      )
      .get(leadId) as
      | {
          status: string | null;
          full_name: string | null;
          phone: string | null;
          care_stage_current: string | null;
          care_stages_done_json: string | null;
        }
      | undefined;
    return row ?? null;
  }

  private async hasContactOkReport(leadId: number): Promise<boolean> {
    if (this.config.crmLeadsLegacyPg) {
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
    const row = this.sqliteDb
      .prepare(
        `SELECT 1 AS ok FROM crm_lead_activities
         WHERE lead_id = ? AND care_stage_key = 'first_contact'
           AND activity_type != 'system'
           AND trim(COALESCE(care_status, '')) = ?
         LIMIT 1`,
      )
      .get(leadId, CONTACT_OK_CARE_STATUS) as { ok: number } | undefined;
    return Boolean(row);
  }

  private async hasOutreachActivity(leadId: number): Promise<boolean> {
    if (this.config.crmLeadsLegacyPg) {
      const result = await this.db.query(
        `SELECT 1 FROM crm_lead_activities
         WHERE lead_id = $1
           AND activity_type = ANY($2::text[])
         LIMIT 1`,
        [leadId, ['call', 'email', 'message', 'meeting']],
      );
      return (result.rowCount ?? 0) > 0;
    }
    const row = this.sqliteDb
      .prepare(
        `SELECT 1 AS ok FROM crm_lead_activities
         WHERE lead_id = ? AND activity_type IN ('call', 'email', 'message', 'meeting')
         LIMIT 1`,
      )
      .get(leadId) as { ok: number } | undefined;
    return Boolean(row);
  }

  private leadNeedsCleanup(fullName: string | null, phone: string | null): boolean {
    const name = String(fullName ?? '').trim();
    const ph = String(phone ?? '').trim();
    return name.length < 2 || ph.length < 8;
  }
}
