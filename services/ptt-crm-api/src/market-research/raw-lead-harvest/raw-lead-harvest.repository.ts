import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type {
  RawLeadHarvestJobRow,
  RawLeadHarvestMode,
  RawLeadRow,
} from './raw-lead-harvest.types';

function iso(value: unknown): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

@Injectable()
export class RawLeadHarvestRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async onModuleDestroy() {
    await this.pool?.end();
    this.pool = null;
  }

  async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.createSchema().catch((err) => {
        this.schemaReady = null;
        throw err;
      });
    }
    await this.schemaReady;
  }

  private async createSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_research_raw_lead_harvest_jobs (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        project_id BIGINT NOT NULL,
        industry_key TEXT NOT NULL,
        industry_label TEXT NOT NULL,
        job_title_key TEXT NOT NULL,
        job_title_label TEXT NOT NULL,
        province_code TEXT NOT NULL,
        province_name TEXT NOT NULL,
        ward_code TEXT,
        ward_name TEXT,
        sources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        channels_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        provider_base_url TEXT,
        credential_id BIGINT,
        mode TEXT NOT NULL DEFAULT 'quality',
        cross_check BOOLEAN NOT NULL DEFAULT FALSE,
        target_count INT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        error_message TEXT,
        result_count INT NOT NULL DEFAULT 0,
        rejected_by_gate_count INT NOT NULL DEFAULT 0,
        created_by_staff_id INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_raw_lead_harvest_jobs_project
        ON crm_research_raw_lead_harvest_jobs (project_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS crm_research_raw_leads (
        id BIGSERIAL PRIMARY KEY,
        project_id BIGINT NOT NULL,
        job_id BIGINT NOT NULL REFERENCES crm_research_raw_lead_harvest_jobs(id) ON DELETE CASCADE,
        company_name TEXT NOT NULL,
        company_name_norm TEXT,
        address TEXT,
        phone TEXT,
        phone_norm TEXT,
        email TEXT,
        contact_title TEXT,
        website TEXT,
        evidence_url TEXT,
        evidence_snippet TEXT,
        source_provider TEXT,
        source_model TEXT,
        search_source_keys TEXT[],
        search_channel_keys TEXT[],
        discovered_via_source_key TEXT,
        confidence NUMERIC,
        quality_score NUMERIC NOT NULL DEFAULT 0,
        icp_fit_score NUMERIC NOT NULL DEFAULT 0,
        verify_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        contactable BOOLEAN NOT NULL DEFAULT FALSE,
        phone_kind TEXT,
        legal_status TEXT,
        dial_outcome TEXT,
        dial_outcome_at TIMESTAMPTZ,
        raw_json JSONB,
        status TEXT NOT NULL DEFAULT 'pending',
        feedback_code TEXT,
        feedback_note TEXT,
        feedback_by_staff_id INT,
        accepted_checklist_json JSONB,
        crm_lead_id BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_raw_leads_project_status
        ON crm_research_raw_leads (project_id, status);
      CREATE INDEX IF NOT EXISTS idx_raw_leads_job ON crm_research_raw_leads (job_id);

      CREATE TABLE IF NOT EXISTS crm_research_raw_lead_blacklist (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        kind TEXT NOT NULL,
        value_norm TEXT NOT NULL,
        reason TEXT,
        created_by_staff_id INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, kind, value_norm)
      );
      CREATE INDEX IF NOT EXISTS idx_raw_lead_blacklist_kind_value
        ON crm_research_raw_lead_blacklist (kind, value_norm);
    `);
  }

  private mapJob(row: Record<string, unknown>): RawLeadHarvestJobRow {
    const sources =
      typeof row.sources_json === 'string'
        ? JSON.parse(row.sources_json)
        : row.sources_json ?? [];
    const channels =
      typeof row.channels_json === 'string'
        ? JSON.parse(row.channels_json)
        : row.channels_json ?? [];
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      industry_key: String(row.industry_key),
      industry_label: String(row.industry_label),
      job_title_key: String(row.job_title_key),
      job_title_label: String(row.job_title_label),
      province_code: String(row.province_code),
      province_name: String(row.province_name),
      ward_code: row.ward_code == null ? null : String(row.ward_code),
      ward_name: row.ward_name == null ? null : String(row.ward_name),
      sources_json: sources as Array<{ key: string; label: string }>,
      channels_json: channels as Array<{ key: string; label: string }>,
      provider: String(row.provider),
      model: String(row.model),
      mode: (row.mode === 'volume' ? 'volume' : 'quality') as RawLeadHarvestMode,
      cross_check: Boolean(row.cross_check),
      target_count: Number(row.target_count),
      notes: row.notes == null ? null : String(row.notes),
      status: String(row.status),
      error_message: row.error_message == null ? null : String(row.error_message),
      result_count: Number(row.result_count ?? 0),
      rejected_by_gate_count: Number(row.rejected_by_gate_count ?? 0),
      created_by_staff_id:
        row.created_by_staff_id == null ? null : Number(row.created_by_staff_id),
      created_at: iso(row.created_at) ?? '',
      started_at: iso(row.started_at),
      finished_at: iso(row.finished_at),
    };
  }

  private mapLead(row: Record<string, unknown>): RawLeadRow {
    const verify =
      typeof row.verify_json === 'string'
        ? JSON.parse(row.verify_json)
        : row.verify_json ?? {};
    const sourceKeys = Array.isArray(row.search_source_keys)
      ? row.search_source_keys.map(String)
      : [];
    const channelKeys = Array.isArray(row.search_channel_keys)
      ? row.search_channel_keys.map(String)
      : [];
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      job_id: Number(row.job_id),
      company_name: String(row.company_name),
      address: row.address == null ? null : String(row.address),
      phone: row.phone == null ? null : String(row.phone),
      phone_norm: row.phone_norm == null ? null : String(row.phone_norm),
      email: row.email == null ? null : String(row.email),
      contact_title: row.contact_title == null ? null : String(row.contact_title),
      website: row.website == null ? null : String(row.website),
      evidence_url: row.evidence_url == null ? null : String(row.evidence_url),
      evidence_snippet: row.evidence_snippet == null ? null : String(row.evidence_snippet),
      source_provider: row.source_provider == null ? null : String(row.source_provider),
      source_model: row.source_model == null ? null : String(row.source_model),
      search_source_keys: sourceKeys,
      search_channel_keys: channelKeys,
      quality_score: Number(row.quality_score ?? 0),
      icp_fit_score: Number(row.icp_fit_score ?? 0),
      contactable: Boolean(row.contactable),
      status: String(row.status),
      feedback_code: row.feedback_code == null ? null : String(row.feedback_code),
      feedback_note: row.feedback_note == null ? null : String(row.feedback_note),
      dial_outcome: row.dial_outcome == null ? null : String(row.dial_outcome),
      dial_outcome_at: iso(row.dial_outcome_at),
      legal_status: row.legal_status == null ? null : String(row.legal_status),
      crm_lead_id: row.crm_lead_id == null ? null : Number(row.crm_lead_id),
      verify_json: verify as Record<string, unknown>,
      created_at: iso(row.created_at) ?? '',
      updated_at: iso(row.updated_at) ?? '',
    };
  }

  async countRunningJobs(projectId: number): Promise<number> {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM crm_research_raw_lead_harvest_jobs
       WHERE project_id = $1 AND status IN ('queued','running')`,
      [projectId],
    );
    return Number(r.rows[0]?.n ?? 0);
  }

  async createJob(input: {
    project_id: number;
    industry_key: string;
    industry_label: string;
    job_title_key: string;
    job_title_label: string;
    province_code: string;
    province_name: string;
    ward_code: string | null;
    ward_name: string | null;
    sources_json: Array<{ key: string; label: string }>;
    channels_json: Array<{ key: string; label: string }>;
    provider: string;
    model: string;
    provider_base_url: string | null;
    credential_id: number | null;
    mode: RawLeadHarvestMode;
    cross_check: boolean;
    target_count: number;
    notes: string | null;
    created_by_staff_id: number | null;
  }): Promise<RawLeadHarvestJobRow> {
    await this.ensureSchema();
    const r = await this.db.query(
      `INSERT INTO crm_research_raw_lead_harvest_jobs (
         project_id, industry_key, industry_label, job_title_key, job_title_label,
         province_code, province_name, ward_code, ward_name,
         sources_json, channels_json, provider, model, provider_base_url, credential_id,
         mode, cross_check, target_count, notes, status, created_by_staff_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,'queued',$20
       ) RETURNING *`,
      [
        input.project_id,
        input.industry_key,
        input.industry_label,
        input.job_title_key,
        input.job_title_label,
        input.province_code,
        input.province_name,
        input.ward_code,
        input.ward_name,
        JSON.stringify(input.sources_json),
        JSON.stringify(input.channels_json),
        input.provider,
        input.model,
        input.provider_base_url,
        input.credential_id,
        input.mode,
        input.cross_check,
        input.target_count,
        input.notes,
        input.created_by_staff_id,
      ],
    );
    return this.mapJob(r.rows[0]);
  }

  async listJobs(projectId: number): Promise<RawLeadHarvestJobRow[]> {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT * FROM crm_research_raw_lead_harvest_jobs
       WHERE project_id = $1 ORDER BY id DESC LIMIT 50`,
      [projectId],
    );
    return r.rows.map((row) => this.mapJob(row));
  }

  async getJob(projectId: number, jobId: number): Promise<RawLeadHarvestJobRow | null> {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT * FROM crm_research_raw_lead_harvest_jobs WHERE project_id = $1 AND id = $2`,
      [projectId, jobId],
    );
    return r.rows[0] ? this.mapJob(r.rows[0]) : null;
  }

  async markJobRunning(jobId: number): Promise<void> {
    await this.db.query(
      `UPDATE crm_research_raw_lead_harvest_jobs
       SET status = 'running', started_at = NOW() WHERE id = $1`,
      [jobId],
    );
  }

  async markJobFinished(
    jobId: number,
    status: 'succeeded' | 'failed',
    resultCount: number,
    rejectedCount: number,
    errorMessage?: string | null,
  ): Promise<void> {
    await this.db.query(
      `UPDATE crm_research_raw_lead_harvest_jobs
       SET status = $2, result_count = $3, rejected_by_gate_count = $4,
           error_message = $5, finished_at = NOW()
       WHERE id = $1`,
      [jobId, status, resultCount, rejectedCount, errorMessage ?? null],
    );
  }

  async setJobCredentialId(jobId: number, credentialId: number): Promise<void> {
    await this.db.query(
      `UPDATE crm_research_raw_lead_harvest_jobs SET credential_id = $2 WHERE id = $1`,
      [jobId, credentialId],
    );
  }

  async listDedupeKeys(projectId: number): Promise<
    Array<{ company_key: string; phone_norm: string | null; email_norm: string | null }>
  > {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT company_name_norm, phone_norm, lower(nullif(trim(email), '')) AS email_norm
       FROM crm_research_raw_leads
       WHERE project_id = $1
       LIMIT 2000`,
      [projectId],
    );
    return r.rows.map((row) => ({
      company_key: String(row.company_name_norm ?? ''),
      phone_norm: row.phone_norm == null ? null : String(row.phone_norm),
      email_norm: row.email_norm == null ? null : String(row.email_norm),
    }));
  }

  /** Soft flag: phone already on an existing CRM lead (digits-only match). */
  async findAlreadyCustomerByPhone(phoneNorm: string): Promise<boolean> {
    const digits = String(phoneNorm ?? '').replace(/\D+/g, '');
    if (digits.length < 9) return false;
    try {
      const r = await this.db.query(
        `SELECT 1 FROM crm_leads
         WHERE regexp_replace(coalesce(phone, ''), '\\D', '', 'g') IN ($1, $2)
         LIMIT 1`,
        [digits, digits.startsWith('0') ? digits.slice(1) : `0${digits}`],
      );
      return Boolean(r.rows[0]);
    } catch {
      return false;
    }
  }

  async insertLead(input: {
    project_id: number;
    job_id: number;
    company_name: string;
    company_name_norm?: string | null;
    address: string | null;
    phone: string | null;
    phone_norm?: string | null;
    email: string | null;
    contact_title: string | null;
    website: string | null;
    evidence_url: string | null;
    evidence_snippet: string | null;
    source_provider: string;
    source_model: string;
    search_source_keys: string[];
    search_channel_keys: string[];
    discovered_via_source_key?: string | null;
    confidence?: number | null;
    quality_score: number;
    icp_fit_score: number;
    contactable: boolean;
    phone_kind?: string | null;
    legal_status?: string | null;
    status: string;
    verify_json: Record<string, unknown>;
    raw_json?: Record<string, unknown>;
  }): Promise<RawLeadRow> {
    await this.ensureSchema();
    const r = await this.db.query(
      `INSERT INTO crm_research_raw_leads (
         project_id, job_id, company_name, company_name_norm, address, phone, phone_norm, email,
         contact_title, website, evidence_url, evidence_snippet,
         source_provider, source_model, search_source_keys, search_channel_keys,
         discovered_via_source_key, confidence,
         quality_score, icp_fit_score, contactable, phone_kind, legal_status, status, verify_json, raw_json
       ) VALUES (
         $1,$2,$3,COALESCE($4, lower($3)),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb,$26::jsonb
       ) RETURNING *`,
      [
        input.project_id,
        input.job_id,
        input.company_name,
        input.company_name_norm ?? null,
        input.address,
        input.phone,
        input.phone_norm ?? null,
        input.email,
        input.contact_title,
        input.website,
        input.evidence_url,
        input.evidence_snippet,
        input.source_provider,
        input.source_model,
        input.search_source_keys,
        input.search_channel_keys,
        input.discovered_via_source_key ?? null,
        input.confidence ?? null,
        input.quality_score,
        input.icp_fit_score,
        input.contactable,
        input.phone_kind ?? null,
        input.legal_status ?? null,
        input.status,
        JSON.stringify(input.verify_json),
        JSON.stringify(input.raw_json ?? {}),
      ],
    );
    return this.mapLead(r.rows[0]);
  }

  async listLeads(
    projectId: number,
    opts?: { status?: string; job_id?: number; include_auto_rejected?: boolean },
  ): Promise<RawLeadRow[]> {
    await this.ensureSchema();
    const clauses = ['project_id = $1'];
    const params: unknown[] = [projectId];
    if (opts?.status) {
      params.push(opts.status);
      clauses.push(`status = $${params.length}`);
    } else if (!opts?.include_auto_rejected) {
      clauses.push(`status <> 'auto_rejected'`);
    }
    if (opts?.job_id) {
      params.push(opts.job_id);
      clauses.push(`job_id = $${params.length}`);
    }
    const r = await this.db.query(
      `SELECT * FROM crm_research_raw_leads
       WHERE ${clauses.join(' AND ')}
       ORDER BY quality_score DESC, id DESC
       LIMIT 500`,
      params,
    );
    return r.rows.map((row) => this.mapLead(row));
  }

  async getLead(projectId: number, leadId: number): Promise<RawLeadRow | null> {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT * FROM crm_research_raw_leads WHERE project_id = $1 AND id = $2`,
      [projectId, leadId],
    );
    return r.rows[0] ? this.mapLead(r.rows[0]) : null;
  }

  async patchLead(
    projectId: number,
    leadId: number,
    patch: Record<string, unknown>,
  ): Promise<RawLeadRow | null> {
    await this.ensureSchema();
    const existing = await this.getLead(projectId, leadId);
    if (!existing) return null;
    const dialAt =
      patch.dial_outcome !== undefined && patch.dial_outcome != null
        ? new Date().toISOString()
        : null;
    const r = await this.db.query(
      `UPDATE crm_research_raw_leads SET
         status = COALESCE($3, status),
         company_name = COALESCE($4, company_name),
         address = COALESCE($5, address),
         phone = COALESCE($6, phone),
         email = COALESCE($7, email),
         contact_title = COALESCE($8, contact_title),
         accepted_checklist_json = COALESCE($9::jsonb, accepted_checklist_json),
         feedback_code = COALESCE($10, feedback_code),
         feedback_note = COALESCE($11, feedback_note),
         feedback_by_staff_id = COALESCE($12, feedback_by_staff_id),
         dial_outcome = COALESCE($13, dial_outcome),
         dial_outcome_at = COALESCE($14::timestamptz, dial_outcome_at),
         updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [
        projectId,
        leadId,
        patch.status ?? null,
        patch.company_name ?? null,
        patch.address !== undefined ? patch.address : null,
        patch.phone !== undefined ? patch.phone : null,
        patch.email !== undefined ? patch.email : null,
        patch.contact_title !== undefined ? patch.contact_title : null,
        patch.accepted_checklist_json
          ? JSON.stringify(patch.accepted_checklist_json)
          : null,
        patch.feedback_code ?? null,
        patch.feedback_note ?? null,
        patch.feedback_by_staff_id ?? null,
        patch.dial_outcome ?? null,
        dialAt,
      ],
    );
    return r.rows[0] ? this.mapLead(r.rows[0]) : null;
  }

  async upsertBlacklistEntries(
    entries: Array<{ kind: string; value_norm: string; reason: string }>,
    staffId: number | null,
  ): Promise<number> {
    await this.ensureSchema();
    let n = 0;
    for (const e of entries) {
      if (!e.value_norm) continue;
      await this.db.query(
        `INSERT INTO crm_research_raw_lead_blacklist
           (kind, value_norm, reason, created_by_staff_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, kind, value_norm) DO UPDATE
           SET reason = EXCLUDED.reason`,
        [e.kind, e.value_norm, e.reason, staffId],
      );
      n += 1;
    }
    return n;
  }

  async listBlacklistEntries(limit = 5000): Promise<
    Array<{ kind: 'phone' | 'email' | 'company_norm' | 'domain'; value_norm: string }>
  > {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT kind, value_norm FROM crm_research_raw_lead_blacklist
       ORDER BY id DESC LIMIT $1`,
      [limit],
    );
    return r.rows.map((row) => ({
      kind: String(row.kind) as 'phone' | 'email' | 'company_norm' | 'domain',
      value_norm: String(row.value_norm),
    }));
  }

  async listLeadsForExport(
    projectId: number,
    opts: { lead_ids?: number[]; status?: string; contactableOnly?: boolean },
  ): Promise<RawLeadRow[]> {
    await this.ensureSchema();
    const clauses = ['project_id = $1'];
    const params: unknown[] = [projectId];
    if (opts.lead_ids?.length) {
      params.push(opts.lead_ids);
      clauses.push(`id = ANY($${params.length}::bigint[])`);
    } else {
      const status = opts.status ?? 'accepted';
      params.push(status);
      clauses.push(`status = $${params.length}`);
      if (opts.contactableOnly !== false) {
        clauses.push(`contactable IS TRUE`);
      }
    }
    const r = await this.db.query(
      `SELECT * FROM crm_research_raw_leads
       WHERE ${clauses.join(' AND ')}
       ORDER BY quality_score DESC, id DESC
       LIMIT 2000`,
      params,
    );
    return r.rows.map((row) => this.mapLead(row));
  }

  async markLeadPushed(
    projectId: number,
    leadId: number,
    crmLeadId: number,
  ): Promise<RawLeadRow | null> {
    await this.ensureSchema();
    const r = await this.db.query(
      `UPDATE crm_research_raw_leads
       SET status = 'pushed', crm_lead_id = $3, updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [projectId, leadId, crmLeadId],
    );
    return r.rows[0] ? this.mapLead(r.rows[0]) : null;
  }

  async getJobById(jobId: number): Promise<RawLeadHarvestJobRow | null> {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT * FROM crm_research_raw_lead_harvest_jobs WHERE id = $1`,
      [jobId],
    );
    return r.rows[0] ? this.mapJob(r.rows[0]) : null;
  }
}
