import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  CareReportRow,
  CaseEventRow,
  CaseRow,
  CreateCareReportBody,
  CRM_CARE_CONTACT_LABELS,
  CRM_CARE_STATUS_LABELS,
  CRM_CHANNEL_LABELS,
  CRM_PRIORITY_LABELS,
  CRM_STATUS_LABELS,
  CRM_STATUSES,
  normalizeCareContact,
  normalizeCareStatus,
  normalizeCaseChannel,
  normalizeCasePriority,
  normalizeCaseStatus,
  PatchCaseBody,
} from './cases.types';

const CASE_SELECT = `
SELECT c.*,
       cu.name AS customer_name,
       cu.phone AS customer_phone,
       cu.email AS customer_email,
       cu.address AS customer_address,
       cu.company AS customer_company,
       st.name AS staff_display_name
FROM crm_cases c
JOIN crm_customers cu ON cu.id = c.customer_id
LEFT JOIN crm_staff st ON st.id = c.assigned_staff_id
`;

function text(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

@Injectable()
export class CasesPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

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
    this.schemaReady = null;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.bootstrapSchema();
    }
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_cases (
        id BIGSERIAL PRIMARY KEY,
        sqlite_case_id BIGINT UNIQUE,
        customer_id BIGINT NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        channel TEXT NOT NULL DEFAULT 'khac',
        priority TEXT NOT NULL DEFAULT 'binh_thuong',
        status TEXT NOT NULL DEFAULT 'moi',
        assigned_to TEXT NOT NULL DEFAULT '',
        assigned_staff_id BIGINT,
        assigned_at TIMESTAMPTZ,
        pipeline_stage TEXT NOT NULL DEFAULT 'moi',
        stage_entered_at TIMESTAMPTZ,
        lead_source TEXT NOT NULL DEFAULT '',
        deal_value_vnd BIGINT NOT NULL DEFAULT 0,
        campaign_id BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE crm_cases ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'moi';
      ALTER TABLE crm_cases ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ;
      ALTER TABLE crm_cases ADD COLUMN IF NOT EXISTS lead_source TEXT NOT NULL DEFAULT '';
      ALTER TABLE crm_cases ADD COLUMN IF NOT EXISTS deal_value_vnd BIGINT NOT NULL DEFAULT 0;
      ALTER TABLE crm_cases ADD COLUMN IF NOT EXISTS campaign_id BIGINT;

      CREATE TABLE IF NOT EXISTS crm_case_events (
        id BIGSERIAL PRIMARY KEY,
        case_id BIGINT NOT NULL REFERENCES crm_cases(id) ON DELETE CASCADE,
        kind VARCHAR(64) NOT NULL DEFAULT 'ghi_chu',
        body TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS crm_care_reports (
        id BIGSERIAL PRIMARY KEY,
        case_id BIGINT NOT NULL REFERENCES crm_cases(id) ON DELETE CASCADE,
        staff_id BIGINT REFERENCES crm_staff(id) ON DELETE SET NULL,
        staff_name VARCHAR(240) NOT NULL DEFAULT '',
        contact_type VARCHAR(64) NOT NULL DEFAULT 'goi_dien',
        care_status VARCHAR(64) NOT NULL DEFAULT 'da_lien_he_thanh_cong',
        summary TEXT NOT NULL DEFAULT '',
        next_action VARCHAR(800) NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_crm_cases_customer ON crm_cases(customer_id);
      CREATE INDEX IF NOT EXISTS idx_crm_cases_assigned_staff ON crm_cases(assigned_staff_id);
      CREATE INDEX IF NOT EXISTS idx_crm_cases_pipeline ON crm_cases(pipeline_stage, stage_entered_at);
      CREATE INDEX IF NOT EXISTS idx_crm_case_events_case ON crm_case_events(case_id, id);
      CREATE INDEX IF NOT EXISTS idx_crm_care_reports_case ON crm_care_reports(case_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_crm_care_reports_staff ON crm_care_reports(staff_id, created_at DESC);
    `);
  }

  async listCases(staffId?: number): Promise<CaseRow[]> {
    await this.ensureSchema();
    const assigned = staffId != null && Number.isFinite(staffId);
    const result = await this.db.query(
      `${CASE_SELECT}
       ${assigned ? 'WHERE c.assigned_staff_id = $1' : ''}
       ORDER BY c.updated_at DESC, c.id DESC`,
      assigned ? [staffId] : [],
    );
    return result.rows.map((row) => this.mapCaseRow(row));
  }

  async getCaseById(caseId: number): Promise<CaseRow | null> {
    await this.ensureSchema();
    const result = await this.db.query(`${CASE_SELECT} WHERE c.id = $1`, [caseId]);
    return result.rows[0] ? this.mapCaseRow(result.rows[0]) : null;
  }

  async patchCase(caseId: number, body: PatchCaseBody): Promise<CaseRow | null> {
    await this.ensureSchema();
    const result = await this.db.query('SELECT * FROM crm_cases WHERE id = $1', [caseId]);
    const existing = result.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;

    const merged: Record<string, unknown> = { ...existing };
    if ('title' in body && typeof body.title === 'string') {
      merged.title = body.title.trim().slice(0, 800);
    }
    if ('description' in body && typeof body.description === 'string') {
      merged.description = body.description.trim().slice(0, 8000);
    }
    if ('status' in body) merged.status = normalizeCaseStatus(body.status);
    if ('priority' in body) merged.priority = normalizeCasePriority(body.priority);
    if ('pipeline_stage' in body && typeof body.pipeline_stage === 'string') {
      merged.pipeline_stage = body.pipeline_stage.trim().slice(0, 64);
    }
    if ('channel' in body) merged.channel = normalizeCaseChannel(body.channel);
    if ('assigned_staff_id' in body || 'assigned_to' in body) {
      const rawId = body.assigned_staff_id;
      if (rawId == null || rawId === 0) {
        merged.assigned_staff_id = null;
        merged.assigned_to = String(body.assigned_to ?? '').trim().slice(0, 240);
        merged.assigned_at = null;
      } else {
        const staffId = Number(rawId);
        if (Number.isFinite(staffId) && staffId > 0) {
          merged.assigned_staff_id = staffId;
          const staff = await this.db.query('SELECT name FROM crm_staff WHERE id = $1', [staffId]);
          merged.assigned_to = String(staff.rows[0]?.name ?? body.assigned_to ?? '').slice(0, 240);
          merged.assigned_at = catalogTs();
        }
      }
    }

    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_cases
       SET title = $2, description = $3, channel = $4, priority = $5, status = $6,
           assigned_to = $7, assigned_staff_id = $8, assigned_at = $9::timestamptz,
           pipeline_stage = $10, updated_at = $11::timestamptz
       WHERE id = $1`,
      [
        caseId,
        String(merged.title ?? ''),
        String(merged.description ?? ''),
        String(merged.channel ?? ''),
        String(merged.priority ?? ''),
        String(merged.status ?? ''),
        String(merged.assigned_to ?? ''),
        merged.assigned_staff_id != null ? Number(merged.assigned_staff_id) : null,
        text(merged.assigned_at) || null,
        String(merged.pipeline_stage ?? ''),
        ts,
      ],
    );
    return this.getCaseById(caseId);
  }

  async listEvents(caseId: number): Promise<CaseEventRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT id, case_id, kind, body, created_at
       FROM crm_case_events
       WHERE case_id = $1
       ORDER BY id ASC`,
      [caseId],
    );
    return result.rows.map((row) => this.mapEventRow(row));
  }

  async createEvent(caseId: number, body: string): Promise<CaseEventRow> {
    await this.ensureSchema();
    const ts = catalogTs();
    const result = await this.db.query(
      `INSERT INTO crm_case_events (case_id, kind, body, created_at)
       VALUES ($1, 'ghi_chu', $2, $3::timestamptz)
       RETURNING id`,
      [caseId, body, ts],
    );
    await this.db.query(
      'UPDATE crm_cases SET updated_at = $2::timestamptz WHERE id = $1',
      [caseId, ts],
    );
    const inserted = await this.db.query(
      'SELECT id, case_id, kind, body, created_at FROM crm_case_events WHERE id = $1',
      [Number(result.rows[0].id)],
    );
    return this.mapEventRow(inserted.rows[0]);
  }

  async listCareReports(caseId: number, limit = 50): Promise<CareReportRow[]> {
    await this.ensureSchema();
    const capped = Math.max(1, Math.min(Number(limit) || 50, 200));
    const result = await this.db.query(
      `SELECT * FROM crm_care_reports
       WHERE case_id = $1
       ORDER BY id DESC
       LIMIT $2`,
      [caseId, capped],
    );
    return result.rows.map((row) => this.mapCareReportRow(row));
  }

  async createCareReport(caseId: number, body: CreateCareReportBody): Promise<CareReportRow> {
    const caseRow = await this.getCaseById(caseId);
    if (!caseRow) throw new Error('Case not found');

    let staffId: number | null = null;
    if (body.staff_id != null && body.staff_id !== 0) {
      const parsed = Number(body.staff_id);
      staffId = Number.isFinite(parsed) ? parsed : null;
    }
    let staffName = '';
    if (staffId) {
      const staff = await this.db.query(
        'SELECT name FROM crm_staff WHERE id = $1 AND active IS TRUE',
        [staffId],
      );
      if (staff.rows[0]) {
        staffName = String(staff.rows[0].name);
      } else {
        staffId = null;
      }
    }
    if (!staffId && caseRow.assigned_staff_id) {
      staffId = caseRow.assigned_staff_id;
      staffName = caseRow.staff_display_name || caseRow.assigned_to;
    }

    const contactType = normalizeCareContact(body.contact_type);
    const careStatus = normalizeCareStatus(body.care_status);
    const summary = String(body.summary ?? '').trim().slice(0, 4000);
    const nextAction = String(body.next_action ?? '').trim().slice(0, 800);
    const ts = catalogTs();
    const result = await this.db.query(
      `INSERT INTO crm_care_reports (
         case_id, staff_id, staff_name, contact_type, care_status,
         summary, next_action, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
       RETURNING id`,
      [caseId, staffId, staffName, contactType, careStatus, summary, nextAction, ts],
    );
    await this.db.query(
      'UPDATE crm_cases SET updated_at = $2::timestamptz WHERE id = $1',
      [caseId, ts],
    );
    const inserted = await this.db.query('SELECT * FROM crm_care_reports WHERE id = $1', [
      Number(result.rows[0].id),
    ]);
    return this.mapCareReportRow(inserted.rows[0]);
  }

  isValidStatus(status: string): boolean {
    return (CRM_STATUSES as readonly string[]).includes(status);
  }

  private mapCaseRow(row: Record<string, unknown>): CaseRow {
    const displayName = row.staff_display_name;
    const status = String(row.status ?? '');
    const priority = String(row.priority ?? '');
    const channel = String(row.channel ?? '');
    return {
      id: Number(row.id),
      customer_id: Number(row.customer_id),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      channel,
      channel_label: CRM_CHANNEL_LABELS[channel] ?? channel,
      priority,
      priority_label: CRM_PRIORITY_LABELS[priority] ?? priority,
      status,
      status_label: CRM_STATUS_LABELS[status] ?? status,
      pipeline_stage: String(row.pipeline_stage ?? ''),
      assigned_to: displayName ? String(displayName) : String(row.assigned_to ?? ''),
      assigned_staff_id: row.assigned_staff_id != null ? Number(row.assigned_staff_id) : null,
      assigned_at: text(row.assigned_at),
      campaign_id: row.campaign_id != null ? Number(row.campaign_id) : null,
      created_at: text(row.created_at),
      updated_at: text(row.updated_at),
      customer_name: String(row.customer_name ?? ''),
      customer_phone: String(row.customer_phone ?? ''),
      customer_email: String(row.customer_email ?? ''),
      customer_address: String(row.customer_address ?? ''),
      customer_company: String(row.customer_company ?? ''),
      staff_display_name: String(displayName ?? ''),
    };
  }

  private mapEventRow(row: Record<string, unknown>): CaseEventRow {
    return {
      id: Number(row.id),
      case_id: Number(row.case_id),
      kind: String(row.kind ?? ''),
      body: String(row.body ?? ''),
      created_at: text(row.created_at),
    };
  }

  private mapCareReportRow(row: Record<string, unknown>): CareReportRow {
    const contactType = String(row.contact_type ?? '');
    const careStatus = String(row.care_status ?? '');
    return {
      id: Number(row.id),
      case_id: Number(row.case_id),
      staff_id: row.staff_id != null ? Number(row.staff_id) : null,
      staff_name: String(row.staff_name ?? ''),
      contact_type: contactType,
      contact_type_label: CRM_CARE_CONTACT_LABELS[contactType] ?? contactType,
      care_status: careStatus,
      care_status_label: CRM_CARE_STATUS_LABELS[careStatus] ?? careStatus,
      summary: String(row.summary ?? ''),
      next_action: String(row.next_action ?? ''),
      created_at: text(row.created_at),
    };
  }
}
