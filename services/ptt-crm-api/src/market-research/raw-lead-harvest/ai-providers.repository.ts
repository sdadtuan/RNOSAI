import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import {
  decryptProviderSecret,
  encryptProviderSecret,
} from '../../cp/cp-magnific-oauth.util';
import { researchAiTokenHint } from './token-hint.util';
import type {
  CreateResearchAiCredentialBody,
  CreateResearchAiModelBody,
  CreateResearchAiProviderBody,
  HarvestProviderOption,
  PatchResearchAiCredentialBody,
  PatchResearchAiModelBody,
  PatchResearchAiProviderBody,
  ResearchAiAuthType,
  ResearchAiCredentialPublic,
  ResearchAiModelRow,
  ResearchAiProviderRow,
} from './ai-providers.types';

function iso(value: unknown): string {
  if (value == null) return '';
  return value instanceof Date ? value.toISOString() : String(value);
}

function slugCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

@Injectable()
export class ResearchAiProvidersRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
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
      CREATE TABLE IF NOT EXISTS crm_research_ai_providers (
        id BIGSERIAL PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        code VARCHAR(64) NOT NULL,
        display_name VARCHAR(120) NOT NULL,
        base_url TEXT NOT NULL,
        auth_type VARCHAR(32) NOT NULL DEFAULT 'bearer_api_key',
        auth_header_name VARCHAR(80),
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, code)
      );
      CREATE TABLE IF NOT EXISTS crm_research_ai_models (
        id BIGSERIAL PRIMARY KEY,
        provider_id BIGINT NOT NULL REFERENCES crm_research_ai_providers(id) ON DELETE CASCADE,
        model_id VARCHAR(120) NOT NULL,
        label VARCHAR(120) NOT NULL,
        recommended_for VARCHAR(32),
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (provider_id, model_id)
      );
      CREATE TABLE IF NOT EXISTS crm_research_ai_credentials (
        id BIGSERIAL PRIMARY KEY,
        provider_id BIGINT NOT NULL REFERENCES crm_research_ai_providers(id) ON DELETE CASCADE,
        label VARCHAR(120) NOT NULL,
        secret_cipher TEXT NOT NULL,
        token_hint VARCHAR(16) NOT NULL,
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_by_staff_id INT,
        updated_by_staff_id INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS crm_research_ai_credential_audit (
        id BIGSERIAL PRIMARY KEY,
        credential_id BIGINT,
        provider_id BIGINT NOT NULL,
        action VARCHAR(32) NOT NULL,
        staff_id INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  private mapProvider(
    row: Record<string, unknown>,
    extras?: { model_count?: number; has_enabled_credential?: boolean },
  ): ResearchAiProviderRow {
    return {
      id: Number(row.id),
      code: String(row.code),
      display_name: String(row.display_name),
      base_url: String(row.base_url),
      auth_type: String(row.auth_type) as ResearchAiAuthType,
      auth_header_name: row.auth_header_name == null ? null : String(row.auth_header_name),
      enabled: Boolean(row.enabled),
      sort_order: Number(row.sort_order ?? 0),
      notes: row.notes == null ? null : String(row.notes),
      model_count: extras?.model_count ?? Number(row.model_count ?? 0),
      has_enabled_credential:
        extras?.has_enabled_credential ?? Boolean(row.has_enabled_credential),
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    };
  }

  private mapModel(row: Record<string, unknown>): ResearchAiModelRow {
    return {
      id: Number(row.id),
      provider_id: Number(row.provider_id),
      model_id: String(row.model_id),
      label: String(row.label),
      recommended_for: row.recommended_for == null ? null : String(row.recommended_for),
      is_default: Boolean(row.is_default),
      enabled: Boolean(row.enabled),
      sort_order: Number(row.sort_order ?? 0),
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    };
  }

  private mapCredentialPublic(row: Record<string, unknown>): ResearchAiCredentialPublic {
    return {
      id: Number(row.id),
      provider_id: Number(row.provider_id),
      label: String(row.label),
      token_hint: String(row.token_hint),
      is_primary: Boolean(row.is_primary),
      enabled: Boolean(row.enabled),
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    };
  }

  async listProviders(): Promise<ResearchAiProviderRow[]> {
    await this.ensureSchema();
    const result = await this.db.query(`
      SELECT p.*,
        (SELECT COUNT(*)::int FROM crm_research_ai_models m WHERE m.provider_id = p.id) AS model_count,
        EXISTS (
          SELECT 1 FROM crm_research_ai_credentials c
          WHERE c.provider_id = p.id AND c.enabled IS TRUE
        ) AS has_enabled_credential
      FROM crm_research_ai_providers p
      ORDER BY p.sort_order ASC, p.id ASC
    `);
    return result.rows.map((row) => this.mapProvider(row));
  }

  async getProvider(id: number): Promise<ResearchAiProviderRow> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT p.*,
        (SELECT COUNT(*)::int FROM crm_research_ai_models m WHERE m.provider_id = p.id) AS model_count,
        EXISTS (
          SELECT 1 FROM crm_research_ai_credentials c
          WHERE c.provider_id = p.id AND c.enabled IS TRUE
        ) AS has_enabled_credential
       FROM crm_research_ai_providers p WHERE p.id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException({ error: 'ai_provider_not_found' });
    return this.mapProvider(row);
  }

  async createProvider(body: CreateResearchAiProviderBody): Promise<ResearchAiProviderRow> {
    await this.ensureSchema();
    const code = slugCode(body.code);
    if (!code) throw new BadRequestException({ error: 'invalid_provider_code' });
    const displayName = String(body.display_name ?? '').trim().slice(0, 120);
    const baseUrl = String(body.base_url ?? '').trim();
    if (!displayName || !baseUrl) {
      throw new BadRequestException({ error: 'display_name_and_base_url_required' });
    }
    const authType: ResearchAiAuthType =
      body.auth_type === 'header_api_key' ? 'header_api_key' : 'bearer_api_key';
    try {
      const result = await this.db.query(
        `INSERT INTO crm_research_ai_providers
           (code, display_name, base_url, auth_type, auth_header_name, enabled, sort_order, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          code,
          displayName,
          baseUrl,
          authType,
          body.auth_header_name ?? (authType === 'bearer_api_key' ? 'Authorization' : 'x-api-key'),
          body.enabled !== false,
          Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
          body.notes ?? null,
        ],
      );
      return this.mapProvider(result.rows[0], { model_count: 0, has_enabled_credential: false });
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        throw new BadRequestException({ error: 'duplicate_provider_code' });
      }
      throw error;
    }
  }

  async patchProvider(id: number, body: PatchResearchAiProviderBody): Promise<ResearchAiProviderRow> {
    const existing = await this.getProvider(id);
    const authType: ResearchAiAuthType =
      body.auth_type === 'header_api_key'
        ? 'header_api_key'
        : body.auth_type === 'bearer_api_key'
          ? 'bearer_api_key'
          : existing.auth_type;
    await this.db.query(
      `UPDATE crm_research_ai_providers
       SET display_name = $2, base_url = $3, auth_type = $4, auth_header_name = $5,
           enabled = $6, sort_order = $7, notes = $8, updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        body.display_name !== undefined
          ? String(body.display_name).trim().slice(0, 120)
          : existing.display_name,
        body.base_url !== undefined ? String(body.base_url).trim() : existing.base_url,
        authType,
        body.auth_header_name !== undefined ? body.auth_header_name : existing.auth_header_name,
        body.enabled !== undefined ? body.enabled : existing.enabled,
        body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))
          ? Number(body.sort_order)
          : existing.sort_order,
        body.notes !== undefined ? body.notes : existing.notes,
      ],
    );
    return this.getProvider(id);
  }

  async deleteProvider(id: number): Promise<{ ok: true; id: number }> {
    await this.ensureSchema();
    const used = await this.isProviderUsedInHarvestJobs(id);
    if (used) throw new ConflictException({ error: 'provider_in_use_disable_instead' });
    const result = await this.db.query(`DELETE FROM crm_research_ai_providers WHERE id = $1`, [id]);
    if (!result.rowCount) throw new NotFoundException({ error: 'ai_provider_not_found' });
    return { ok: true, id };
  }

  async listModels(providerId: number): Promise<ResearchAiModelRow[]> {
    await this.getProvider(providerId);
    const result = await this.db.query(
      `SELECT * FROM crm_research_ai_models WHERE provider_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [providerId],
    );
    return result.rows.map((row) => this.mapModel(row));
  }

  async createModel(
    providerId: number,
    body: CreateResearchAiModelBody,
  ): Promise<ResearchAiModelRow> {
    await this.getProvider(providerId);
    const modelId = String(body.model_id ?? '').trim().slice(0, 120);
    const label = String(body.label ?? modelId).trim().slice(0, 120);
    if (!modelId || !label) throw new BadRequestException({ error: 'model_id_and_label_required' });
    const isDefault = Boolean(body.is_default);
    if (isDefault) {
      await this.db.query(
        `UPDATE crm_research_ai_models SET is_default = FALSE, updated_at = NOW()
         WHERE provider_id = $1 AND is_default IS TRUE`,
        [providerId],
      );
    }
    try {
      const result = await this.db.query(
        `INSERT INTO crm_research_ai_models
           (provider_id, model_id, label, recommended_for, is_default, enabled, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          providerId,
          modelId,
          label,
          body.recommended_for ?? null,
          isDefault,
          body.enabled !== false,
          Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
        ],
      );
      return this.mapModel(result.rows[0]);
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        throw new BadRequestException({ error: 'duplicate_model_id' });
      }
      throw error;
    }
  }

  async patchModel(modelId: number, body: PatchResearchAiModelBody): Promise<ResearchAiModelRow> {
    await this.ensureSchema();
    const existing = await this.db.query(`SELECT * FROM crm_research_ai_models WHERE id = $1`, [
      modelId,
    ]);
    const row = existing.rows[0];
    if (!row) throw new NotFoundException({ error: 'ai_model_not_found' });
    const isDefault = body.is_default !== undefined ? Boolean(body.is_default) : Boolean(row.is_default);
    if (isDefault) {
      await this.db.query(
        `UPDATE crm_research_ai_models SET is_default = FALSE, updated_at = NOW()
         WHERE provider_id = $1 AND is_default IS TRUE AND id <> $2`,
        [row.provider_id, modelId],
      );
    }
    const result = await this.db.query(
      `UPDATE crm_research_ai_models
       SET label = $2, recommended_for = $3, is_default = $4, enabled = $5, sort_order = $6,
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        modelId,
        body.label !== undefined ? String(body.label).trim().slice(0, 120) : String(row.label),
        body.recommended_for !== undefined ? body.recommended_for : row.recommended_for,
        isDefault,
        body.enabled !== undefined ? body.enabled : Boolean(row.enabled),
        body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))
          ? Number(body.sort_order)
          : Number(row.sort_order ?? 0),
      ],
    );
    return this.mapModel(result.rows[0]);
  }

  async deleteModel(modelId: number): Promise<{ ok: true; id: number }> {
    await this.ensureSchema();
    const existing = await this.db.query(`SELECT * FROM crm_research_ai_models WHERE id = $1`, [
      modelId,
    ]);
    if (!existing.rows[0]) throw new NotFoundException({ error: 'ai_model_not_found' });
    const used = await this.isModelUsedInHarvestJobs(String(existing.rows[0].model_id));
    if (used) throw new ConflictException({ error: 'model_in_use_disable_instead' });
    await this.db.query(`DELETE FROM crm_research_ai_models WHERE id = $1`, [modelId]);
    return { ok: true, id: modelId };
  }

  async listCredentials(providerId: number): Promise<ResearchAiCredentialPublic[]> {
    await this.getProvider(providerId);
    const result = await this.db.query(
      `SELECT id, provider_id, label, token_hint, is_primary, enabled, created_at, updated_at
       FROM crm_research_ai_credentials WHERE provider_id = $1
       ORDER BY is_primary DESC, id DESC`,
      [providerId],
    );
    return result.rows.map((row) => this.mapCredentialPublic(row));
  }

  async createCredential(
    providerId: number,
    body: CreateResearchAiCredentialBody,
    staffId: number | null,
  ): Promise<ResearchAiCredentialPublic> {
    await this.getProvider(providerId);
    const label = String(body.label ?? '').trim().slice(0, 120);
    const token = String(body.api_token ?? '').trim();
    if (!label || !token) throw new BadRequestException({ error: 'label_and_api_token_required' });
    const cipher = encryptProviderSecret(token);
    const hint = researchAiTokenHint(token);
    const isPrimary = body.is_primary !== false;
    if (isPrimary) {
      await this.db.query(
        `UPDATE crm_research_ai_credentials SET is_primary = FALSE, updated_at = NOW()
         WHERE provider_id = $1 AND is_primary IS TRUE`,
        [providerId],
      );
    }
    const result = await this.db.query(
      `INSERT INTO crm_research_ai_credentials
         (provider_id, label, secret_cipher, token_hint, is_primary, enabled,
          created_by_staff_id, updated_by_staff_id)
       VALUES ($1,$2,$3,$4,$5,TRUE,$6,$6) RETURNING
         id, provider_id, label, token_hint, is_primary, enabled, created_at, updated_at`,
      [providerId, label, cipher, hint, isPrimary, staffId],
    );
    await this.audit(result.rows[0].id, providerId, 'create', staffId);
    return this.mapCredentialPublic(result.rows[0]);
  }

  async patchCredential(
    credId: number,
    body: PatchResearchAiCredentialBody,
    staffId: number | null,
  ): Promise<ResearchAiCredentialPublic> {
    await this.ensureSchema();
    const existing = await this.db.query(`SELECT * FROM crm_research_ai_credentials WHERE id = $1`, [
      credId,
    ]);
    const row = existing.rows[0];
    if (!row) throw new NotFoundException({ error: 'ai_credential_not_found' });
    let cipher = String(row.secret_cipher);
    let hint = String(row.token_hint);
    let action: string | null = null;
    if (body.api_token !== undefined) {
      const token = String(body.api_token ?? '').trim();
      if (!token) throw new BadRequestException({ error: 'api_token_required' });
      cipher = encryptProviderSecret(token);
      hint = researchAiTokenHint(token);
      action = 'rotate';
    }
    const isPrimary =
      body.is_primary !== undefined ? Boolean(body.is_primary) : Boolean(row.is_primary);
    if (isPrimary) {
      await this.db.query(
        `UPDATE crm_research_ai_credentials SET is_primary = FALSE, updated_at = NOW()
         WHERE provider_id = $1 AND is_primary IS TRUE AND id <> $2`,
        [row.provider_id, credId],
      );
    }
    const enabled = body.enabled !== undefined ? body.enabled : Boolean(row.enabled);
    if (body.enabled !== undefined && body.enabled !== Boolean(row.enabled)) {
      action = body.enabled ? 'enable' : 'disable';
    }
    const result = await this.db.query(
      `UPDATE crm_research_ai_credentials
       SET label = $2, secret_cipher = $3, token_hint = $4, is_primary = $5, enabled = $6,
           updated_by_staff_id = $7, updated_at = NOW()
       WHERE id = $1
       RETURNING id, provider_id, label, token_hint, is_primary, enabled, created_at, updated_at`,
      [
        credId,
        body.label !== undefined ? String(body.label).trim().slice(0, 120) : String(row.label),
        cipher,
        hint,
        isPrimary,
        enabled,
        staffId,
      ],
    );
    if (action) await this.audit(credId, Number(row.provider_id), action, staffId);
    return this.mapCredentialPublic(result.rows[0]);
  }

  async deleteCredential(
    credId: number,
    staffId: number | null,
  ): Promise<{ ok: true; id: number }> {
    await this.ensureSchema();
    const existing = await this.db.query(`SELECT * FROM crm_research_ai_credentials WHERE id = $1`, [
      credId,
    ]);
    if (!existing.rows[0]) throw new NotFoundException({ error: 'ai_credential_not_found' });
    const used = await this.isCredentialUsedInHarvestJobs(credId);
    if (used) throw new ConflictException({ error: 'credential_in_use_disable_instead' });
    await this.audit(credId, Number(existing.rows[0].provider_id), 'delete', staffId);
    await this.db.query(`DELETE FROM crm_research_ai_credentials WHERE id = $1`, [credId]);
    return { ok: true, id: credId };
  }

  async resolveRuntimeCredential(providerCode: string): Promise<{
    provider: ResearchAiProviderRow;
    apiToken: string;
    authHeaderName: string;
    authType: ResearchAiAuthType;
    credentialId: number;
  } | null> {
    await this.ensureSchema();
    const providers = await this.db.query(
      `SELECT * FROM crm_research_ai_providers WHERE code = $1 AND enabled IS TRUE LIMIT 1`,
      [slugCode(providerCode)],
    );
    const p = providers.rows[0];
    if (!p) return null;
    const creds = await this.db.query(
      `SELECT * FROM crm_research_ai_credentials
       WHERE provider_id = $1 AND enabled IS TRUE
       ORDER BY is_primary DESC, id DESC LIMIT 1`,
      [p.id],
    );
    const c = creds.rows[0];
    if (!c) return null;
    return {
      provider: this.mapProvider(p, { model_count: 0, has_enabled_credential: true }),
      apiToken: decryptProviderSecret(String(c.secret_cipher)),
      authHeaderName: String(p.auth_header_name || 'Authorization'),
      authType: String(p.auth_type) as ResearchAiAuthType,
      credentialId: Number(c.id),
    };
  }

  async listHarvestProviders(): Promise<HarvestProviderOption[]> {
    await this.ensureSchema();
    const providers = await this.db.query(
      `SELECT * FROM crm_research_ai_providers WHERE enabled IS TRUE ORDER BY sort_order ASC, id ASC`,
    );
    const out: HarvestProviderOption[] = [];
    for (const p of providers.rows) {
      const models = await this.db.query(
        `SELECT * FROM crm_research_ai_models
         WHERE provider_id = $1 AND enabled IS TRUE
         ORDER BY is_default DESC, sort_order ASC, id ASC`,
        [p.id],
      );
      const cred = await this.db.query(
        `SELECT 1 FROM crm_research_ai_credentials
         WHERE provider_id = $1 AND enabled IS TRUE LIMIT 1`,
        [p.id],
      );
      const configured = Boolean(cred.rows[0]);
      const defaultModel =
        models.rows.find((m) => m.is_default)?.model_id ?? models.rows[0]?.model_id ?? null;
      out.push({
        code: String(p.code),
        display_name: String(p.display_name),
        configured,
        default_model: defaultModel ? String(defaultModel) : null,
        models: models.rows.map((m) => ({
          id: String(m.model_id),
          label: String(m.label),
          recommended_for: m.recommended_for ? String(m.recommended_for) : undefined,
        })),
      });
    }
    return out;
  }

  private async audit(
    credentialId: number | null,
    providerId: number,
    action: string,
    staffId: number | null,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO crm_research_ai_credential_audit (credential_id, provider_id, action, staff_id)
       VALUES ($1,$2,$3,$4)`,
      [credentialId, providerId, action, staffId],
    );
  }

  /** Stub until harvest jobs table exists (Task 4). */
  private async isProviderUsedInHarvestJobs(_providerId: number): Promise<boolean> {
    await this.ensureSchema();
    const exists = await this.db.query(`
      SELECT to_regclass('public.crm_research_raw_lead_harvest_jobs') AS reg
    `);
    if (!exists.rows[0]?.reg) return false;
    const provider = await this.db.query(`SELECT code FROM crm_research_ai_providers WHERE id = $1`, [
      _providerId,
    ]);
    const code = provider.rows[0]?.code;
    if (!code) return false;
    const used = await this.db.query(
      `SELECT 1 FROM crm_research_raw_lead_harvest_jobs WHERE provider = $1 LIMIT 1`,
      [code],
    );
    return Boolean(used.rows[0]);
  }

  private async isModelUsedInHarvestJobs(modelId: string): Promise<boolean> {
    await this.ensureSchema();
    const exists = await this.db.query(`
      SELECT to_regclass('public.crm_research_raw_lead_harvest_jobs') AS reg
    `);
    if (!exists.rows[0]?.reg) return false;
    const used = await this.db.query(
      `SELECT 1 FROM crm_research_raw_lead_harvest_jobs WHERE model = $1 LIMIT 1`,
      [modelId],
    );
    return Boolean(used.rows[0]);
  }

  private async isCredentialUsedInHarvestJobs(credId: number): Promise<boolean> {
    await this.ensureSchema();
    const exists = await this.db.query(`
      SELECT to_regclass('public.crm_research_raw_lead_harvest_jobs') AS reg
    `);
    if (!exists.rows[0]?.reg) return false;
    const used = await this.db.query(
      `SELECT 1 FROM crm_research_raw_lead_harvest_jobs WHERE credential_id = $1 LIMIT 1`,
      [credId],
    );
    return Boolean(used.rows[0]);
  }
}
