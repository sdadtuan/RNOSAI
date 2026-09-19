import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type {
  RawLeadHarvestJobRow,
  RawLeadHarvestMode,
  RawLeadRow,
  ResearchAccountRow,
} from './raw-lead-harvest.types';
import {
  offsetForPage,
  type RawLeadListQuery,
} from './raw-lead-list-query.util';

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
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS classification TEXT
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_lead_harvest_jobs
        ADD COLUMN IF NOT EXISTS scan_cap INT
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_lead_harvest_jobs
        ADD COLUMN IF NOT EXISTS stats_json JSONB
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS place_id TEXT
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS intent_score INT
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS market_entity_id UUID
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS fanpage_url TEXT
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS zalo_url TEXT
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS readiness_status TEXT
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS readiness_reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS account_cluster_key TEXT
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS priority_tier TEXT
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS learning_delta NUMERIC NOT NULL DEFAULT 0
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS learning_reasons JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS learning_applied_at TIMESTAMPTZ
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS global_account_key TEXT
    `);
    await this.db.query(`
      ALTER TABLE crm_research_raw_leads
        ADD COLUMN IF NOT EXISTS research_account_id BIGINT
    `);
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_research_accounts (
        id BIGSERIAL PRIMARY KEY,
        global_account_key TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        phone_norm TEXT,
        domain TEXT,
        place_id TEXT,
        lead_count INT NOT NULL DEFAULT 0,
        project_count INT NOT NULL DEFAULT 0,
        best_priority_tier TEXT,
        crm_lead_id BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_raw_leads_research_account
        ON crm_research_raw_leads (research_account_id)
        WHERE research_account_id IS NOT NULL
    `);
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_raw_leads_project_readiness
        ON crm_research_raw_leads (project_id, readiness_status)
    `);
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_raw_leads_project_cluster
        ON crm_research_raw_leads (project_id, account_cluster_key)
    `);
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_raw_leads_project_priority
        ON crm_research_raw_leads (project_id, priority_tier)
    `);
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_raw_leads_global_account
        ON crm_research_raw_leads (global_account_key)
        WHERE global_account_key IS NOT NULL AND btrim(global_account_key) <> ''
    `);
    await this.db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_leads_project_place
        ON crm_research_raw_leads (project_id, place_id)
        WHERE place_id IS NOT NULL AND btrim(place_id) <> ''
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
    const stats =
      typeof row.stats_json === 'string'
        ? JSON.parse(row.stats_json)
        : row.stats_json ?? null;
    const modeRaw = String(row.mode ?? 'quality');
    const mode: RawLeadHarvestMode =
      modeRaw === 'volume'
        ? 'volume'
        : modeRaw === 'marketing'
          ? 'marketing'
          : modeRaw === 'intent'
            ? 'intent'
            : modeRaw === 'market_graph'
              ? 'market_graph'
              : 'quality';
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
      mode,
      cross_check: Boolean(row.cross_check),
      target_count: Number(row.target_count),
      scan_cap: row.scan_cap == null ? null : Number(row.scan_cap),
      notes: row.notes == null ? null : String(row.notes),
      status: String(row.status),
      error_message: row.error_message == null ? null : String(row.error_message),
      result_count: Number(row.result_count ?? 0),
      rejected_by_gate_count: Number(row.rejected_by_gate_count ?? 0),
      stats_json: (stats && typeof stats === 'object' ? stats : null) as Record<
        string,
        unknown
      > | null,
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
      fanpage_url: row.fanpage_url == null ? null : String(row.fanpage_url),
      zalo_url: row.zalo_url == null ? null : String(row.zalo_url),
      evidence_url: row.evidence_url == null ? null : String(row.evidence_url),
      evidence_snippet: row.evidence_snippet == null ? null : String(row.evidence_snippet),
      source_provider: row.source_provider == null ? null : String(row.source_provider),
      source_model: row.source_model == null ? null : String(row.source_model),
      search_source_keys: sourceKeys,
      search_channel_keys: channelKeys,
      place_id: row.place_id == null ? null : String(row.place_id),
      intent_score: row.intent_score == null ? null : Number(row.intent_score),
      market_entity_id:
        row.market_entity_id == null ? null : String(row.market_entity_id),
      quality_score: Number(row.quality_score ?? 0),
      icp_fit_score: Number(row.icp_fit_score ?? 0),
      contactable: Boolean(row.contactable),
      status: String(row.status),
      feedback_code: row.feedback_code == null ? null : String(row.feedback_code),
      feedback_note: row.feedback_note == null ? null : String(row.feedback_note),
      dial_outcome: row.dial_outcome == null ? null : String(row.dial_outcome),
      dial_outcome_at: iso(row.dial_outcome_at),
      legal_status: row.legal_status == null ? null : String(row.legal_status),
      classification: row.classification == null ? null : String(row.classification),
      readiness_status:
        row.readiness_status == null ? null : String(row.readiness_status),
      readiness_reason_codes: Array.isArray(row.readiness_reason_codes)
        ? row.readiness_reason_codes.map(String)
        : typeof row.readiness_reason_codes === 'string'
          ? (() => {
              try {
                const parsed = JSON.parse(row.readiness_reason_codes);
                return Array.isArray(parsed) ? parsed.map(String) : [];
              } catch {
                return [];
              }
            })()
          : [],
      account_cluster_key:
        row.account_cluster_key == null ? null : String(row.account_cluster_key),
      priority_tier: row.priority_tier == null ? null : String(row.priority_tier),
      global_account_key:
        row.global_account_key == null ? null : String(row.global_account_key),
      research_account_id:
        row.research_account_id == null ? null : Number(row.research_account_id),
      industry_key: row.industry_key == null ? null : String(row.industry_key),
      industry_label: row.industry_label == null ? null : String(row.industry_label),
      learning_delta: Number(row.learning_delta ?? 0) || 0,
      learning_reasons: Array.isArray(row.learning_reasons)
        ? row.learning_reasons.map(String)
        : typeof row.learning_reasons === 'string'
          ? (() => {
              try {
                const parsed = JSON.parse(row.learning_reasons);
                return Array.isArray(parsed) ? parsed.map(String) : [];
              } catch {
                return [];
              }
            })()
          : [],
      learning_applied_at: iso(row.learning_applied_at),
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
    scan_cap?: number | null;
    notes: string | null;
    created_by_staff_id: number | null;
  }): Promise<RawLeadHarvestJobRow> {
    await this.ensureSchema();
    const r = await this.db.query(
      `INSERT INTO crm_research_raw_lead_harvest_jobs (
         project_id, industry_key, industry_label, job_title_key, job_title_label,
         province_code, province_name, ward_code, ward_name,
         sources_json, channels_json, provider, model, provider_base_url, credential_id,
         mode, cross_check, target_count, scan_cap, notes, status, created_by_staff_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,$20,'queued',$21
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
        input.scan_cap ?? null,
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
    statsJson?: Record<string, unknown> | null,
  ): Promise<void> {
    await this.db.query(
      `UPDATE crm_research_raw_lead_harvest_jobs
       SET status = $2, result_count = $3, rejected_by_gate_count = $4,
           error_message = $5, stats_json = COALESCE($6::jsonb, stats_json), finished_at = NOW()
       WHERE id = $1`,
      [
        jobId,
        status,
        resultCount,
        rejectedCount,
        errorMessage ?? null,
        statsJson ? JSON.stringify(statsJson) : null,
      ],
    );
  }

  async hasRecentAcceptedOrPushed(
    projectId: number,
    opts: { phone_norm?: string | null; company_name_norm?: string | null; days?: number },
  ): Promise<boolean> {
    await this.ensureSchema();
    const days = opts.days ?? 90;
    const clauses: string[] = [
      'project_id = $1',
      `status IN ('accepted','pushed')`,
      `created_at > NOW() - ($2::text || ' days')::interval`,
    ];
    const params: unknown[] = [projectId, String(days)];
    const orParts: string[] = [];
    if (opts.phone_norm) {
      params.push(opts.phone_norm);
      orParts.push(`phone_norm = $${params.length}`);
    }
    if (opts.company_name_norm) {
      params.push(opts.company_name_norm);
      orParts.push(`company_name_norm = $${params.length}`);
    }
    if (!orParts.length) return false;
    clauses.push(`(${orParts.join(' OR ')})`);
    const r = await this.db.query(
      `SELECT 1 FROM crm_research_raw_leads WHERE ${clauses.join(' AND ')} LIMIT 1`,
      params,
    );
    return Boolean(r.rows[0]);
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

  async hasPlaceIdInProject(projectId: number, placeId: string): Promise<boolean> {
    const id = String(placeId ?? '').trim();
    if (!id) return false;
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT 1 FROM crm_research_raw_leads
       WHERE project_id = $1 AND place_id = $2
       LIMIT 1`,
      [projectId, id],
    );
    return Boolean(r.rows[0]);
  }

  async hasDuplicatePhoneInProject(
    projectId: number,
    phoneNorm: string,
  ): Promise<boolean> {
    const digits = String(phoneNorm ?? '').replace(/\D+/g, '');
    if (digits.length < 9) return false;
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT 1 FROM crm_research_raw_leads
       WHERE project_id = $1
         AND phone_norm IS NOT NULL
         AND phone_norm <> ''
         AND phone_norm = $2
       LIMIT 1`,
      [projectId, digits],
    );
    return Boolean(r.rows[0]);
  }

  async hasDuplicatePhoneInProjectExcept(
    projectId: number,
    phoneNorm: string,
    exceptLeadId: number,
  ): Promise<boolean> {
    const digits = String(phoneNorm ?? '').replace(/\D+/g, '');
    if (digits.length < 9) return false;
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT 1 FROM crm_research_raw_leads
       WHERE project_id = $1
         AND id <> $3
         AND phone_norm IS NOT NULL
         AND phone_norm <> ''
         AND phone_norm = $2
       LIMIT 1`,
      [projectId, digits, exceptLeadId],
    );
    return Boolean(r.rows[0]);
  }

  async listLeadsForReclassify(
    projectId: number,
    opts: {
      only_unclassified?: boolean;
      job_id?: number;
      lead_ids?: number[];
      limit?: number;
    } = {},
  ): Promise<RawLeadRow[]> {
    await this.ensureSchema();
    const clauses = ['project_id = $1', `status <> 'pushed'`];
    const params: unknown[] = [projectId];

    if (opts.only_unclassified !== false) {
      clauses.push(`(readiness_status IS NULL OR btrim(readiness_status) = '')`);
    }

    if (opts.job_id) {
      params.push(opts.job_id);
      clauses.push(`job_id = $${params.length}`);
    }

    if (opts.lead_ids?.length) {
      params.push(opts.lead_ids);
      clauses.push(`id = ANY($${params.length}::bigint[])`);
    }

    const limit = Math.min(5000, Math.max(1, Math.floor(Number(opts.limit) || 2000)));
    params.push(limit);

    const r = await this.db.query(
      `SELECT * FROM crm_research_raw_leads
       WHERE ${clauses.join(' AND ')}
       ORDER BY id ASC
       LIMIT $${params.length}`,
      params,
    );
    return r.rows.map((row) => this.mapLead(row));
  }

  async listLeadsForContactEnrich(
    projectId: number,
    opts: {
      only_missing_contact?: boolean;
      job_id?: number;
      lead_ids?: number[];
      limit?: number;
    } = {},
  ): Promise<RawLeadRow[]> {
    await this.ensureSchema();
    const clauses = ['project_id = $1', `status <> 'pushed'`];
    const params: unknown[] = [projectId];

    if (opts.lead_ids?.length) {
      params.push(opts.lead_ids);
      clauses.push(`id = ANY($${params.length}::bigint[])`);
    } else if (opts.only_missing_contact !== false) {
      clauses.push(`readiness_status = 'MISSING_CONTACT'`);
    }

    if (opts.job_id) {
      params.push(opts.job_id);
      clauses.push(`job_id = $${params.length}`);
    }

    const limit = Math.min(50, Math.max(1, Math.floor(Number(opts.limit) || 50)));
    params.push(limit);

    const r = await this.db.query(
      `SELECT * FROM crm_research_raw_leads
       WHERE ${clauses.join(' AND ')}
       ORDER BY id ASC
       LIMIT $${params.length}`,
      params,
    );
    return r.rows.map((row) => this.mapLead(row));
  }

  async updateLeadContact(
    projectId: number,
    leadId: number,
    input: {
      phone: string | null;
      phone_norm: string | null;
      email: string | null;
      website: string | null;
      fanpage_url: string | null;
      contactable: boolean;
      quality_score?: number;
      verify_json?: Record<string, unknown>;
    },
  ): Promise<RawLeadRow | null> {
    await this.ensureSchema();
    const r = await this.db.query(
      `UPDATE crm_research_raw_leads SET
         phone = $3,
         phone_norm = $4,
         email = $5,
         website = $6,
         fanpage_url = $7,
         contactable = $8,
         quality_score = COALESCE($9, quality_score),
         verify_json = COALESCE($10::jsonb, verify_json),
         updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [
        projectId,
        leadId,
        input.phone,
        input.phone_norm,
        input.email,
        input.website,
        input.fanpage_url,
        input.contactable,
        input.quality_score ?? null,
        input.verify_json ? JSON.stringify(input.verify_json) : null,
      ],
    );
    return r.rows[0] ? this.mapLead(r.rows[0]) : null;
  }

  async updateLeadReadiness(
    projectId: number,
    leadId: number,
    input: {
      readiness_status: string;
      readiness_reason_codes: string[];
      classification?: string | null;
    },
  ): Promise<RawLeadRow | null> {
    await this.ensureSchema();
    const r = await this.db.query(
      `UPDATE crm_research_raw_leads SET
         readiness_status = $3,
         readiness_reason_codes = $4::jsonb,
         classification = COALESCE($5, classification),
         updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [
        projectId,
        leadId,
        input.readiness_status,
        JSON.stringify(input.readiness_reason_codes ?? []),
        input.classification ?? null,
      ],
    );
    return r.rows[0] ? this.mapLead(r.rows[0]) : null;
  }

  async updateLeadPriorityCluster(
    projectId: number,
    leadId: number,
    input: {
      account_cluster_key: string;
      priority_tier: string;
      global_account_key?: string | null;
    },
  ): Promise<RawLeadRow | null> {
    await this.ensureSchema();
    const r = await this.db.query(
      `UPDATE crm_research_raw_leads SET
         account_cluster_key = $3,
         priority_tier = $4,
         global_account_key = $5,
         updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [
        projectId,
        leadId,
        input.account_cluster_key,
        input.priority_tier,
        input.global_account_key ?? null,
      ],
    );
    return r.rows[0] ? this.mapLead(r.rows[0]) : null;
  }

  async updateLeadLearning(
    projectId: number,
    leadId: number,
    input: {
      quality_score: number;
      priority_tier: string;
      learning_delta: number;
      learning_reasons: string[];
    },
  ): Promise<RawLeadRow | null> {
    await this.ensureSchema();
    const r = await this.db.query(
      `UPDATE crm_research_raw_leads SET
         quality_score = $3,
         priority_tier = $4,
         learning_delta = $5,
         learning_reasons = $6::jsonb,
         learning_applied_at = NOW(),
         updated_at = NOW()
       WHERE project_id = $1 AND id = $2
       RETURNING *`,
      [
        projectId,
        leadId,
        input.quality_score,
        input.priority_tier,
        input.learning_delta,
        JSON.stringify(input.learning_reasons ?? []),
      ],
    );
    return r.rows[0] ? this.mapLead(r.rows[0]) : null;
  }

  async listLeadsForLearningApply(
    projectId: number,
    opts: { job_id?: number; lead_ids?: number[]; limit?: number } = {},
  ): Promise<RawLeadRow[]> {
    await this.ensureSchema();
    const clauses = [
      'project_id = $1',
      `status <> 'pushed'`,
      `(dial_outcome IS NOT NULL OR feedback_code IS NOT NULL)`,
    ];
    const params: unknown[] = [projectId];
    if (opts.job_id) {
      params.push(opts.job_id);
      clauses.push(`job_id = $${params.length}`);
    }
    if (opts.lead_ids?.length) {
      params.push(opts.lead_ids);
      clauses.push(`id = ANY($${params.length}::bigint[])`);
    }
    const limit = Math.min(2000, Math.max(1, Math.floor(Number(opts.limit) || 2000)));
    params.push(limit);
    const r = await this.db.query(
      `SELECT * FROM crm_research_raw_leads
       WHERE ${clauses.join(' AND ')}
       ORDER BY id ASC
       LIMIT $${params.length}`,
      params,
    );
    return r.rows.map((row) => this.mapLead(row));
  }

  async listLeadsForPriorityRecompute(
    projectId: number,
    opts: { job_id?: number; lead_ids?: number[]; limit?: number } = {},
  ): Promise<RawLeadRow[]> {
    await this.ensureSchema();
    const clauses = ['project_id = $1', `status <> 'pushed'`];
    const params: unknown[] = [projectId];
    if (opts.job_id) {
      params.push(opts.job_id);
      clauses.push(`job_id = $${params.length}`);
    }
    if (opts.lead_ids?.length) {
      params.push(opts.lead_ids);
      clauses.push(`id = ANY($${params.length}::bigint[])`);
    }
    const limit = Math.min(2000, Math.max(1, Math.floor(Number(opts.limit) || 2000)));
    params.push(limit);
    const r = await this.db.query(
      `SELECT * FROM crm_research_raw_leads
       WHERE ${clauses.join(' AND ')}
       ORDER BY id ASC
       LIMIT $${params.length}`,
      params,
    );
    return r.rows.map((row) => this.mapLead(row));
  }

  async countByPriority(projectId: number): Promise<Record<string, number>> {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT COALESCE(priority_tier, 'UNSET') AS priority_tier, COUNT(*)::int AS n
       FROM crm_research_raw_leads
       WHERE project_id = $1
       GROUP BY 1`,
      [projectId],
    );
    const out: Record<string, number> = { P1: 0, P2: 0, P3: 0, UNSET: 0, ALL: 0 };
    for (const row of r.rows) {
      const key = String(row.priority_tier ?? 'UNSET');
      const n = Number(row.n ?? 0);
      out[key] = (out[key] ?? 0) + n;
      out.ALL += n;
    }
    return out;
  }

  async countByReadiness(
    projectId: number,
  ): Promise<Record<string, number>> {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT COALESCE(readiness_status, 'UNCLASSIFIED') AS readiness_status,
              COUNT(*)::int AS n
       FROM crm_research_raw_leads
       WHERE project_id = $1
       GROUP BY 1`,
      [projectId],
    );
    const out: Record<string, number> = {
      READY_TO_PUSH: 0,
      NEEDS_REVIEW: 0,
      MISSING_CONTACT: 0,
      DUPLICATE_OR_BLACKLIST: 0,
      UNCLASSIFIED: 0,
      ALL: 0,
    };
    for (const row of r.rows) {
      const key = String(row.readiness_status ?? 'UNCLASSIFIED');
      const n = Number(row.n ?? 0);
      out[key] = (out[key] ?? 0) + n;
      out.ALL += n;
    }
    return out;
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
    fanpage_url?: string | null;
    zalo_url?: string | null;
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
    classification?: string | null;
    readiness_status?: string | null;
    readiness_reason_codes?: string[];
    place_id?: string | null;
    intent_score?: number | null;
    market_entity_id?: string | null;
    verify_json: Record<string, unknown>;
    raw_json?: Record<string, unknown>;
  }): Promise<RawLeadRow> {
    await this.ensureSchema();
    const r = await this.db.query(
      `INSERT INTO crm_research_raw_leads (
         project_id, job_id, company_name, company_name_norm, address, phone, phone_norm, email,
         contact_title, website, fanpage_url, zalo_url, evidence_url, evidence_snippet,
         source_provider, source_model, search_source_keys, search_channel_keys,
         discovered_via_source_key, confidence,
         quality_score, icp_fit_score, contactable, phone_kind, legal_status, status,
         classification, readiness_status, readiness_reason_codes, place_id, intent_score,
         market_entity_id, verify_json, raw_json
       ) VALUES (
         $1,$2,$3,COALESCE($4, lower($3)),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29::jsonb,$30,$31,$32::uuid,$33::jsonb,$34::jsonb
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
        input.fanpage_url ?? null,
        input.zalo_url ?? null,
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
        input.classification ?? null,
        input.readiness_status ?? null,
        JSON.stringify(input.readiness_reason_codes ?? []),
        input.place_id ?? null,
        input.intent_score ?? null,
        input.market_entity_id ?? null,
        JSON.stringify(input.verify_json),
        JSON.stringify(input.raw_json ?? {}),
      ],
    );
    return this.mapLead(r.rows[0]);
  }

  async listLeadsPage(
    projectId: number,
    opts: RawLeadListQuery,
  ): Promise<{ leads: RawLeadRow[]; total: number }> {
    await this.ensureSchema();
    const clauses = ['l.project_id = $1'];
    const params: unknown[] = [projectId];

    if (opts.status?.length) {
      params.push(opts.status);
      clauses.push(`l.status = ANY($${params.length}::text[])`);
    } else if (!opts.include_auto_rejected) {
      clauses.push(`l.status <> 'auto_rejected'`);
    }

    if (opts.job_id) {
      params.push(opts.job_id);
      clauses.push(`l.job_id = $${params.length}`);
    }

    if (opts.readiness_status) {
      params.push(opts.readiness_status);
      clauses.push(`l.readiness_status = $${params.length}`);
    }

    if (opts.priority_tier) {
      params.push(opts.priority_tier);
      clauses.push(`l.priority_tier = $${params.length}`);
    }

    if (opts.industry_key) {
      params.push(opts.industry_key);
      clauses.push(`j.industry_key = $${params.length}`);
    }

    if (opts.q) {
      params.push(`%${opts.q}%`);
      const i = params.length;
      clauses.push(
        `(l.company_name ILIKE $${i} OR COALESCE(l.phone, '') ILIKE $${i} OR COALESCE(l.email, '') ILIKE $${i} OR COALESCE(l.address, '') ILIKE $${i})`,
      );
    }

    if (opts.has_phone) {
      clauses.push(`l.phone_norm IS NOT NULL AND l.phone_norm <> ''`);
    }

    if (opts.has_contact) {
      clauses.push(
        `((l.phone_norm IS NOT NULL AND l.phone_norm <> '') OR (l.email IS NOT NULL AND btrim(l.email) <> ''))`,
      );
    }

    const where = clauses.join(' AND ');
    const fromJoin = `crm_research_raw_leads l
       INNER JOIN crm_research_raw_lead_harvest_jobs j ON j.id = l.job_id`;

    const countR = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM ${fromJoin} WHERE ${where}`,
      params,
    );
    const total = Number(countR.rows[0]?.n ?? 0);

    const offset = offsetForPage(opts.page, opts.page_size);
    params.push(opts.page_size);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const r = await this.db.query(
      `SELECT l.*, j.industry_key, j.industry_label
       FROM ${fromJoin}
       WHERE ${where}
       ORDER BY l.quality_score DESC, l.id DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
    return { leads: r.rows.map((row) => this.mapLead(row)), total };
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

  async listClusterMates(
    projectId: number,
    clusterKey: string,
    excludeLeadId: number,
    limit = 8,
  ): Promise<
    Array<{
      id: number;
      company_name: string;
      priority_tier: string | null;
      phone: string | null;
      readiness_status: string | null;
    }>
  > {
    await this.ensureSchema();
    const key = String(clusterKey ?? '').trim();
    if (!key) return [];
    const lim = Math.min(20, Math.max(1, Math.floor(Number(limit) || 8)));
    const r = await this.db.query(
      `SELECT id, company_name, priority_tier, phone, readiness_status
       FROM crm_research_raw_leads
       WHERE project_id = $1
         AND account_cluster_key = $2
         AND id <> $3
       ORDER BY
         CASE priority_tier WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,
         quality_score DESC,
         id ASC
       LIMIT $4`,
      [projectId, key, excludeLeadId, lim],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      company_name: String(row.company_name ?? ''),
      priority_tier: row.priority_tier == null ? null : String(row.priority_tier),
      phone: row.phone == null ? null : String(row.phone),
      readiness_status:
        row.readiness_status == null ? null : String(row.readiness_status),
    }));
  }

  async listCrossProjectMates(
    globalKey: string,
    excludeProjectId: number,
    limit = 12,
  ): Promise<
    Array<{
      id: number;
      project_id: number;
      project_name: string | null;
      company_name: string;
      priority_tier: string | null;
      readiness_status: string | null;
      phone: string | null;
      status: string;
    }>
  > {
    await this.ensureSchema();
    const key = String(globalKey ?? '').trim();
    if (!key) return [];
    const lim = Math.min(24, Math.max(1, Math.floor(Number(limit) || 12)));
    const r = await this.db.query(
      `SELECT l.id, l.project_id, p.title AS project_name, l.company_name,
              l.priority_tier, l.readiness_status, l.phone, l.status
       FROM crm_research_raw_leads l
       LEFT JOIN crm_research_projects p ON p.id = l.project_id
       WHERE l.global_account_key = $1
         AND l.project_id <> $2
       ORDER BY
         CASE l.priority_tier WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,
         l.quality_score DESC,
         l.id ASC
       LIMIT $3`,
      [key, excludeProjectId, lim],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      project_id: Number(row.project_id),
      project_name: row.project_name == null ? null : String(row.project_name),
      company_name: String(row.company_name ?? ''),
      priority_tier: row.priority_tier == null ? null : String(row.priority_tier),
      readiness_status:
        row.readiness_status == null ? null : String(row.readiness_status),
      phone: row.phone == null ? null : String(row.phone),
      status: String(row.status ?? ''),
    }));
  }

  private mapResearchAccount(row: Record<string, unknown>): ResearchAccountRow {
    return {
      id: Number(row.id),
      global_account_key: String(row.global_account_key ?? ''),
      display_name: String(row.display_name ?? ''),
      phone_norm: row.phone_norm == null ? null : String(row.phone_norm),
      domain: row.domain == null ? null : String(row.domain),
      place_id: row.place_id == null ? null : String(row.place_id),
      lead_count: Number(row.lead_count ?? 0),
      project_count: Number(row.project_count ?? 0),
      best_priority_tier:
        row.best_priority_tier == null ? null : String(row.best_priority_tier),
      crm_lead_id: row.crm_lead_id == null ? null : Number(row.crm_lead_id),
      created_at: iso(row.created_at) ?? '',
      updated_at: iso(row.updated_at) ?? '',
    };
  }

  async getResearchAccount(accountId: number): Promise<ResearchAccountRow | null> {
    await this.ensureSchema();
    const r = await this.db.query(
      `SELECT * FROM crm_research_accounts WHERE id = $1`,
      [accountId],
    );
    return r.rows[0] ? this.mapResearchAccount(r.rows[0]) : null;
  }

  async getResearchAccountByKey(globalKey: string): Promise<ResearchAccountRow | null> {
    await this.ensureSchema();
    const key = String(globalKey ?? '').trim();
    if (!key) return null;
    const r = await this.db.query(
      `SELECT * FROM crm_research_accounts WHERE global_account_key = $1`,
      [key],
    );
    return r.rows[0] ? this.mapResearchAccount(r.rows[0]) : null;
  }

  async upsertResearchAccount(input: {
    global_account_key: string;
    display_name: string;
    phone_norm?: string | null;
    domain?: string | null;
    place_id?: string | null;
    best_priority_tier?: string | null;
    crm_lead_id?: number | null;
  }): Promise<ResearchAccountRow> {
    await this.ensureSchema();
    const r = await this.db.query(
      `INSERT INTO crm_research_accounts (
         global_account_key, display_name, phone_norm, domain, place_id,
         best_priority_tier, crm_lead_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (global_account_key) DO UPDATE SET
         display_name = CASE
           WHEN btrim(crm_research_accounts.display_name) = '' THEN EXCLUDED.display_name
           ELSE crm_research_accounts.display_name
         END,
         phone_norm = COALESCE(crm_research_accounts.phone_norm, EXCLUDED.phone_norm),
         domain = COALESCE(crm_research_accounts.domain, EXCLUDED.domain),
         place_id = COALESCE(crm_research_accounts.place_id, EXCLUDED.place_id),
         best_priority_tier = CASE
           WHEN crm_research_accounts.best_priority_tier IS NULL THEN EXCLUDED.best_priority_tier
           WHEN EXCLUDED.best_priority_tier IS NULL THEN crm_research_accounts.best_priority_tier
           WHEN EXCLUDED.best_priority_tier = 'P1' THEN 'P1'
           WHEN crm_research_accounts.best_priority_tier = 'P1' THEN 'P1'
           WHEN EXCLUDED.best_priority_tier = 'P2' THEN 'P2'
           WHEN crm_research_accounts.best_priority_tier = 'P2' THEN 'P2'
           ELSE COALESCE(EXCLUDED.best_priority_tier, crm_research_accounts.best_priority_tier)
         END,
         crm_lead_id = COALESCE(crm_research_accounts.crm_lead_id, EXCLUDED.crm_lead_id),
         updated_at = NOW()
       RETURNING *`,
      [
        input.global_account_key,
        input.display_name,
        input.phone_norm ?? null,
        input.domain ?? null,
        input.place_id ?? null,
        input.best_priority_tier ?? null,
        input.crm_lead_id ?? null,
      ],
    );
    return this.mapResearchAccount(r.rows[0]);
  }

  async linkLeadToResearchAccount(
    projectId: number,
    leadId: number,
    accountId: number,
    globalAccountKey: string,
  ): Promise<void> {
    await this.ensureSchema();
    await this.db.query(
      `UPDATE crm_research_raw_leads SET
         research_account_id = $3,
         global_account_key = COALESCE(NULLIF(btrim(global_account_key), ''), $4),
         updated_at = NOW()
       WHERE project_id = $1 AND id = $2`,
      [projectId, leadId, accountId, globalAccountKey],
    );
  }

  async refreshResearchAccountAggregates(accountId: number): Promise<ResearchAccountRow | null> {
    await this.ensureSchema();
    await this.db.query(
      `UPDATE crm_research_accounts a SET
         lead_count = sub.lead_count,
         project_count = sub.project_count,
         best_priority_tier = sub.best_tier,
         crm_lead_id = COALESCE(a.crm_lead_id, sub.any_crm_lead_id),
         updated_at = NOW()
       FROM (
         SELECT
           COUNT(*)::int AS lead_count,
           COUNT(DISTINCT project_id)::int AS project_count,
           MIN(
             CASE priority_tier
               WHEN 'P1' THEN 1
               WHEN 'P2' THEN 2
               WHEN 'P3' THEN 3
               ELSE 9
             END
           ) AS tier_rank,
           CASE MIN(
             CASE priority_tier
               WHEN 'P1' THEN 1
               WHEN 'P2' THEN 2
               WHEN 'P3' THEN 3
               ELSE 9
             END
           )
             WHEN 1 THEN 'P1'
             WHEN 2 THEN 'P2'
             WHEN 3 THEN 'P3'
             ELSE NULL
           END AS best_tier,
           MIN(crm_lead_id) FILTER (WHERE crm_lead_id IS NOT NULL) AS any_crm_lead_id
         FROM crm_research_raw_leads
         WHERE research_account_id = $1
       ) sub
       WHERE a.id = $1`,
      [accountId],
    );
    return this.getResearchAccount(accountId);
  }

  async setResearchAccountCrmLead(
    accountId: number,
    crmLeadId: number,
  ): Promise<void> {
    await this.ensureSchema();
    await this.db.query(
      `UPDATE crm_research_accounts SET
         crm_lead_id = COALESCE(crm_lead_id, $2),
         updated_at = NOW()
       WHERE id = $1`,
      [accountId, crmLeadId],
    );
  }

  async listLeadsForAccountMerge(
    projectId: number,
    opts: { job_id?: number; lead_ids?: number[]; limit?: number } = {},
  ): Promise<RawLeadRow[]> {
    await this.ensureSchema();
    const clauses = ['project_id = $1', `status <> 'pushed'`];
    const params: unknown[] = [projectId];
    if (opts.job_id) {
      params.push(opts.job_id);
      clauses.push(`job_id = $${params.length}`);
    }
    if (opts.lead_ids?.length) {
      params.push(opts.lead_ids);
      clauses.push(`id = ANY($${params.length}::bigint[])`);
    }
    const limit = Math.min(2000, Math.max(1, Math.floor(Number(opts.limit) || 2000)));
    params.push(limit);
    const r = await this.db.query(
      `SELECT * FROM crm_research_raw_leads
       WHERE ${clauses.join(' AND ')}
       ORDER BY id ASC
       LIMIT $${params.length}`,
      params,
    );
    return r.rows.map((row) => this.mapLead(row));
  }

  async listLeadsByResearchAccount(
    accountId: number,
    limit = 20,
  ): Promise<
    Array<{
      id: number;
      project_id: number;
      company_name: string;
      priority_tier: string | null;
      status: string;
      crm_lead_id: number | null;
    }>
  > {
    await this.ensureSchema();
    const lim = Math.min(50, Math.max(1, Math.floor(Number(limit) || 20)));
    const r = await this.db.query(
      `SELECT id, project_id, company_name, priority_tier, status, crm_lead_id
       FROM crm_research_raw_leads
       WHERE research_account_id = $1
       ORDER BY id DESC
       LIMIT $2`,
      [accountId, lim],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      project_id: Number(row.project_id),
      company_name: String(row.company_name ?? ''),
      priority_tier: row.priority_tier == null ? null : String(row.priority_tier),
      status: String(row.status ?? ''),
      crm_lead_id: row.crm_lead_id == null ? null : Number(row.crm_lead_id),
    }));
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
         website = COALESCE($9, website),
         fanpage_url = COALESCE($10, fanpage_url),
         zalo_url = COALESCE($11, zalo_url),
         accepted_checklist_json = COALESCE($12::jsonb, accepted_checklist_json),
         feedback_code = COALESCE($13, feedback_code),
         feedback_note = COALESCE($14, feedback_note),
         feedback_by_staff_id = COALESCE($15, feedback_by_staff_id),
         dial_outcome = COALESCE($16, dial_outcome),
         dial_outcome_at = COALESCE($17::timestamptz, dial_outcome_at),
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
        patch.website !== undefined ? patch.website : null,
        patch.fanpage_url !== undefined ? patch.fanpage_url : null,
        patch.zalo_url !== undefined ? patch.zalo_url : null,
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
