import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  SALES_PIPELINE_LABELS_VI,
  SALES_PIPELINE_STAGES,
  STAGE_OWNER_ROLE,
  STAGE_SLA_HOURS,
  TERMINAL_STAGES,
} from '../sales/sales-pipeline.util';
import { AppConfigService } from '../config/app-config.service';
import {
  DEFAULT_LEAD_CHANNELS,
  DEFAULT_LEAD_SOURCES,
  DEFAULT_SALES_PIPELINE_KEY,
  defaultSalesPipelineStages,
} from './crm-config.defaults';
import type {
  CreateCustomFieldBody,
  CreateLeadLookupBody,
  CreatePipelineStageBody,
  CustomFieldDef,
  CustomFieldEntityType,
  CustomFieldType,
  LeadLookupKind,
  LeadLookupOption,
  PatchPipelineStageBody,
  PipelineStageDef,
  SalesPipelineConfig,
  UpdateCustomFieldBody,
  UpdateLeadLookupBody,
  UpdatePipelineStagesBody,
} from './crm-config.types';

const ENTITY_TYPES = new Set<CustomFieldEntityType>(['lead', 'customer', 'case']);
const FIELD_TYPES = new Set<CustomFieldType>(['text', 'number', 'select', 'date', 'boolean']);
const LEAD_LOOKUP_KINDS = new Set<LeadLookupKind>(['source', 'channel']);

function slugKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);
}

function iso(value: unknown): string {
  if (value == null) return '';
  return value instanceof Date ? value.toISOString() : String(value);
}

function uniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === '23505' || String(error).includes('duplicate key');
}

@Injectable()
export class CrmConfigPgRepository implements OnModuleDestroy, OnModuleInit {
  private pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;
  private pipelineConfig: SalesPipelineConfig = this.buildPipelineConfig(
    this.fallbackPipelineStages(DEFAULT_SALES_PIPELINE_KEY),
  );

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
    await this.refreshPipelineConfig();
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) this.schemaReady = this.bootstrapSchema();
    await this.schemaReady;
  }

  private async bootstrapSchema(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crm_custom_field_defs (
        id BIGSERIAL PRIMARY KEY,
        entity_type VARCHAR(20) NOT NULL,
        field_key VARCHAR(64) NOT NULL,
        label VARCHAR(120) NOT NULL,
        field_type VARCHAR(20) NOT NULL DEFAULT 'text',
        options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        required BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INT NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (entity_type, field_key)
      );
      CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
        id BIGSERIAL PRIMARY KEY,
        pipeline_key VARCHAR(64) NOT NULL DEFAULT 'sales',
        stage_key VARCHAR(64) NOT NULL,
        label VARCHAR(80) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        sla_hours INT NOT NULL DEFAULT 0,
        owner_role VARCHAR(80) NOT NULL DEFAULT '',
        is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (pipeline_key, stage_key)
      );
      CREATE TABLE IF NOT EXISTS crm_lead_lookup_options (
        id BIGSERIAL PRIMARY KEY,
        kind VARCHAR(20) NOT NULL,
        option_key VARCHAR(64) NOT NULL,
        label VARCHAR(120) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (kind, option_key)
      );
    `);

    const stages = defaultSalesPipelineStages();
    const stageValues = stages.map((_, i) => {
      const n = i * 7;
      return `($${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5}, $${n + 6}, $${n + 7})`;
    }).join(', ');
    await this.db.query(
      `INSERT INTO crm_pipeline_stages
         (pipeline_key, stage_key, label, sort_order, sla_hours, owner_role, is_terminal)
       VALUES ${stageValues}
       ON CONFLICT (pipeline_key, stage_key) DO NOTHING`,
      stages.flatMap((stage) => [
        DEFAULT_SALES_PIPELINE_KEY,
        stage.stage_key,
        stage.label,
        stage.sort_order,
        stage.sla_hours,
        stage.owner_role,
        stage.is_terminal,
      ]),
    );

    const lookups = [
      ...DEFAULT_LEAD_SOURCES.map((item, sortOrder) => ({ kind: 'source', ...item, sortOrder })),
      ...DEFAULT_LEAD_CHANNELS.map((item, sortOrder) => ({ kind: 'channel', ...item, sortOrder })),
    ];
    const lookupValues = lookups.map((_, i) => {
      const n = i * 4;
      return `($${n + 1}, $${n + 2}, $${n + 3}, $${n + 4})`;
    }).join(', ');
    await this.db.query(
      `INSERT INTO crm_lead_lookup_options (kind, option_key, label, sort_order)
       VALUES ${lookupValues}
       ON CONFLICT (kind, option_key) DO NOTHING`,
      lookups.flatMap((item) => [item.kind, item.option_key, item.label, item.sortOrder]),
    );
  }

  private mapLeadLookup(row: Record<string, unknown>): LeadLookupOption {
    return {
      id: Number(row.id),
      kind: String(row.kind) as LeadLookupKind,
      option_key: String(row.option_key),
      label: String(row.label),
      sort_order: Number(row.sort_order ?? 0),
      active: Boolean(row.active),
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    };
  }

  async listLeadLookups(kind?: LeadLookupKind, activeOnly = false): Promise<LeadLookupOption[]> {
    await this.ensureSchema();
    if (kind && !LEAD_LOOKUP_KINDS.has(kind)) throw new BadRequestException({ error: 'invalid_lookup_kind' });
    const clauses: string[] = [];
    const params: string[] = [];
    if (kind) {
      params.push(kind);
      clauses.push(`kind = $${params.length}`);
    }
    if (activeOnly) clauses.push('active IS TRUE');
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.db.query(
      `SELECT * FROM crm_lead_lookup_options${where} ORDER BY kind ASC, sort_order ASC, id ASC`,
      params,
    );
    return result.rows.map((row) => this.mapLeadLookup(row));
  }

  async createLeadLookup(body: CreateLeadLookupBody): Promise<LeadLookupOption> {
    await this.ensureSchema();
    const kind = String(body.kind ?? '').trim() as LeadLookupKind;
    if (!LEAD_LOOKUP_KINDS.has(kind)) throw new BadRequestException({ error: 'invalid_lookup_kind' });
    const optionKey = slugKey(String(body.option_key ?? body.label ?? ''));
    if (!optionKey) throw new BadRequestException({ error: 'invalid_option_key' });
    try {
      const result = await this.db.query(
        `INSERT INTO crm_lead_lookup_options (kind, option_key, label, sort_order, active)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          kind,
          optionKey,
          String(body.label ?? optionKey).trim().slice(0, 120),
          Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 999,
          body.active !== false,
        ],
      );
      return this.mapLeadLookup(result.rows[0]);
    } catch (error) {
      if (uniqueViolation(error)) throw new BadRequestException({ error: 'duplicate_option_key' });
      throw error;
    }
  }

  async updateLeadLookup(id: number, body: UpdateLeadLookupBody): Promise<LeadLookupOption> {
    await this.ensureSchema();
    const existing = await this.db.query('SELECT * FROM crm_lead_lookup_options WHERE id = $1', [id]);
    const row = existing.rows[0];
    if (!row) throw new NotFoundException({ error: 'lead_lookup_not_found' });
    const result = await this.db.query(
      `UPDATE crm_lead_lookup_options
       SET label = $2, sort_order = $3, active = $4, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        body.label !== undefined ? String(body.label).trim().slice(0, 120) : String(row.label),
        body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))
          ? Number(body.sort_order) : Number(row.sort_order ?? 0),
        body.active !== undefined ? body.active : Boolean(row.active),
      ],
    );
    return this.mapLeadLookup(result.rows[0]);
  }

  async deleteLeadLookup(id: number): Promise<{ ok: true; id: number }> {
    await this.ensureSchema();
    const result = await this.db.query('DELETE FROM crm_lead_lookup_options WHERE id = $1', [id]);
    if (!result.rowCount) throw new NotFoundException({ error: 'lead_lookup_not_found' });
    return { ok: true, id };
  }

  private mapCustomField(row: Record<string, unknown>): CustomFieldDef {
    let options: string[] = [];
    const raw = row.options_json;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) options = parsed.map(String);
    } catch {
      options = [];
    }
    return {
      id: Number(row.id),
      entity_type: String(row.entity_type) as CustomFieldEntityType,
      field_key: String(row.field_key),
      label: String(row.label),
      field_type: String(row.field_type) as CustomFieldType,
      options,
      required: Boolean(row.required),
      sort_order: Number(row.sort_order ?? 0),
      active: Boolean(row.active),
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    };
  }

  async getCustomField(id: number): Promise<CustomFieldDef> {
    await this.ensureSchema();
    const result = await this.db.query('SELECT * FROM crm_custom_field_defs WHERE id = $1', [id]);
    if (!result.rows[0]) throw new NotFoundException({ error: 'custom_field_not_found' });
    return this.mapCustomField(result.rows[0]);
  }

  async listCustomFields(entityType?: string): Promise<CustomFieldDef[]> {
    await this.ensureSchema();
    if (entityType && !ENTITY_TYPES.has(entityType as CustomFieldEntityType)) {
      throw new BadRequestException({ error: 'invalid_entity_type' });
    }
    const result = entityType
      ? await this.db.query(
        `SELECT * FROM crm_custom_field_defs WHERE entity_type = $1
         ORDER BY entity_type ASC, sort_order ASC, id ASC`,
        [entityType],
      )
      : await this.db.query(
        'SELECT * FROM crm_custom_field_defs ORDER BY entity_type ASC, sort_order ASC, id ASC',
      );
    return result.rows.map((row) => this.mapCustomField(row));
  }

  async createCustomField(body: CreateCustomFieldBody): Promise<CustomFieldDef> {
    await this.ensureSchema();
    const entityType = String(body.entity_type ?? '').trim() as CustomFieldEntityType;
    if (!ENTITY_TYPES.has(entityType)) throw new BadRequestException({ error: 'invalid_entity_type' });
    const fieldKey = slugKey(String(body.field_key ?? body.label ?? ''));
    if (!fieldKey) throw new BadRequestException({ error: 'invalid_field_key' });
    const fieldType = (String(body.field_type ?? 'text').trim() || 'text') as CustomFieldType;
    if (!FIELD_TYPES.has(fieldType)) throw new BadRequestException({ error: 'invalid_field_type' });
    const options = Array.isArray(body.options)
      ? body.options.map((value) => String(value).trim()).filter(Boolean).slice(0, 50) : [];
    try {
      const result = await this.db.query(
        `INSERT INTO crm_custom_field_defs
           (entity_type, field_key, label, field_type, options_json, required, sort_order, active)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8) RETURNING *`,
        [
          entityType,
          fieldKey,
          String(body.label ?? fieldKey).trim().slice(0, 120),
          fieldType,
          JSON.stringify(options),
          Boolean(body.required),
          Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
          body.active !== false,
        ],
      );
      return this.mapCustomField(result.rows[0]);
    } catch (error) {
      if (uniqueViolation(error)) throw new BadRequestException({ error: 'duplicate_field_key' });
      throw error;
    }
  }

  async updateCustomField(id: number, body: UpdateCustomFieldBody): Promise<CustomFieldDef> {
    await this.ensureSchema();
    const existing = await this.db.query('SELECT * FROM crm_custom_field_defs WHERE id = $1', [id]);
    const row = existing.rows[0];
    if (!row) throw new NotFoundException({ error: 'custom_field_not_found' });
    const fieldType = (body.field_type !== undefined ? String(body.field_type).trim() : String(row.field_type)) as CustomFieldType;
    if (!FIELD_TYPES.has(fieldType)) throw new BadRequestException({ error: 'invalid_field_type' });
    const options = body.options !== undefined
      ? body.options.map((value) => String(value).trim()).filter(Boolean).slice(0, 50)
      : (typeof row.options_json === 'string' ? JSON.parse(row.options_json) : row.options_json);
    const result = await this.db.query(
      `UPDATE crm_custom_field_defs
       SET label = $2, field_type = $3, options_json = $4::jsonb, required = $5,
           sort_order = $6, active = $7, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        body.label !== undefined ? String(body.label).trim().slice(0, 120) : String(row.label),
        fieldType,
        JSON.stringify(options ?? []),
        body.required !== undefined ? body.required : Boolean(row.required),
        body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))
          ? Number(body.sort_order) : Number(row.sort_order ?? 0),
        body.active !== undefined ? body.active : Boolean(row.active),
      ],
    );
    return this.mapCustomField(result.rows[0]);
  }

  async deleteCustomField(id: number): Promise<{ ok: true; id: number }> {
    await this.ensureSchema();
    const result = await this.db.query('DELETE FROM crm_custom_field_defs WHERE id = $1', [id]);
    if (!result.rowCount) throw new NotFoundException({ error: 'custom_field_not_found' });
    return { ok: true, id };
  }

  private mapPipelineStage(row: Record<string, unknown>): PipelineStageDef {
    return {
      id: Number(row.id),
      pipeline_key: String(row.pipeline_key ?? DEFAULT_SALES_PIPELINE_KEY),
      stage_key: String(row.stage_key),
      label: String(row.label),
      sort_order: Number(row.sort_order ?? 0),
      sla_hours: Number(row.sla_hours ?? 0),
      owner_role: String(row.owner_role ?? ''),
      is_terminal: Boolean(row.is_terminal),
      active: Boolean(row.active),
      updated_at: iso(row.updated_at),
    };
  }

  private fallbackPipelineStages(pipelineKey: string): PipelineStageDef[] {
    return defaultSalesPipelineStages().map((stage, index) => ({
      id: index + 1,
      pipeline_key: pipelineKey,
      updated_at: '',
      ...stage,
    }));
  }

  async listPipelineStages(
    pipelineKey = DEFAULT_SALES_PIPELINE_KEY,
    includeInactive = false,
  ): Promise<PipelineStageDef[]> {
    await this.ensureSchema();
    const result = await this.db.query(
      `SELECT * FROM crm_pipeline_stages
       WHERE pipeline_key = $1${includeInactive ? '' : ' AND active IS TRUE'}
       ORDER BY sort_order ASC, id ASC`,
      [pipelineKey],
    );
    const stages = result.rows.length
      ? result.rows.map((row) => this.mapPipelineStage(row))
      : this.fallbackPipelineStages(pipelineKey);
    if (pipelineKey === DEFAULT_SALES_PIPELINE_KEY && !includeInactive) {
      this.pipelineConfig = this.buildPipelineConfig(stages);
    }
    return stages;
  }

  async getPipelineStage(pipelineKey: string, stageKey: string): Promise<PipelineStageDef> {
    await this.ensureSchema();
    const result = await this.db.query(
      'SELECT * FROM crm_pipeline_stages WHERE pipeline_key = $1 AND stage_key = $2',
      [pipelineKey, stageKey],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'pipeline_stage_not_found' });
    return this.mapPipelineStage(result.rows[0]);
  }

  async createPipelineStage(
    pipelineKey: string,
    body: CreatePipelineStageBody,
  ): Promise<PipelineStageDef> {
    await this.ensureSchema();
    const label = String(body.label ?? '').trim();
    if (!label) throw new BadRequestException({ error: 'label_required' });
    const stageKey = slugKey(String(body.stage_key ?? label));
    if (!stageKey) throw new BadRequestException({ error: 'invalid_stage_key' });
    const maxSort = await this.db.query(
      'SELECT MAX(sort_order) AS n FROM crm_pipeline_stages WHERE pipeline_key = $1',
      [pipelineKey],
    );
    try {
      const result = await this.db.query(
        `INSERT INTO crm_pipeline_stages
           (pipeline_key, stage_key, label, sort_order, sla_hours, owner_role, is_terminal, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          pipelineKey,
          stageKey,
          label.slice(0, 80),
          Number.isFinite(Number(body.sort_order))
            ? Number(body.sort_order) : Number(maxSort.rows[0]?.n ?? -1) + 1,
          Math.max(0, Number(body.sla_hours ?? 24) || 0),
          String(body.owner_role ?? 'Sales').trim().slice(0, 80),
          Boolean(body.is_terminal),
          body.active !== false,
        ],
      );
      const stage = this.mapPipelineStage(result.rows[0]);
      await this.refreshPipelineConfig();
      return stage;
    } catch (error) {
      if (uniqueViolation(error)) throw new BadRequestException({ error: 'duplicate_stage_key' });
      throw error;
    }
  }

  async patchPipelineStage(
    pipelineKey: string,
    stageKey: string,
    body: PatchPipelineStageBody,
  ): Promise<PipelineStageDef> {
    const existing = await this.getPipelineStage(pipelineKey, stageKey);
    const label = body.label != null ? String(body.label).trim().slice(0, 80) : existing.label;
    if (!label) throw new BadRequestException({ error: 'label_required' });
    const result = await this.db.query(
      `UPDATE crm_pipeline_stages
       SET label = $3, sort_order = $4, sla_hours = $5, owner_role = $6,
           is_terminal = $7, active = $8, updated_at = NOW()
       WHERE pipeline_key = $1 AND stage_key = $2 RETURNING *`,
      [
        pipelineKey,
        stageKey,
        label,
        body.sort_order != null && Number.isFinite(Number(body.sort_order))
          ? Number(body.sort_order) : existing.sort_order,
        body.sla_hours != null ? Math.max(0, Number(body.sla_hours) || 0) : existing.sla_hours,
        body.owner_role != null ? String(body.owner_role).trim().slice(0, 80) : existing.owner_role,
        body.is_terminal != null ? body.is_terminal : existing.is_terminal,
        body.active != null ? body.active : existing.active,
      ],
    );
    const stage = this.mapPipelineStage(result.rows[0]);
    await this.refreshPipelineConfig();
    return stage;
  }

  async deletePipelineStage(
    pipelineKey: string,
    stageKey: string,
  ): Promise<{ ok: true; stage_key: string }> {
    await this.ensureSchema();
    const result = await this.db.query(
      'DELETE FROM crm_pipeline_stages WHERE pipeline_key = $1 AND stage_key = $2',
      [pipelineKey, stageKey],
    );
    if (!result.rowCount) throw new NotFoundException({ error: 'pipeline_stage_not_found' });
    await this.refreshPipelineConfig();
    return { ok: true, stage_key: stageKey };
  }

  async replacePipelineStages(
    pipelineKey: string,
    body: UpdatePipelineStagesBody,
  ): Promise<PipelineStageDef[]> {
    await this.ensureSchema();
    if (!Array.isArray(body.stages) || !body.stages.length) {
      throw new BadRequestException({ error: 'stages_required' });
    }
    const normalized = body.stages.map((stage, index) => {
      const stageKey = slugKey(String(stage.stage_key ?? stage.label ?? ''));
      if (!stageKey) throw new BadRequestException({ error: 'invalid_stage_key' });
      return {
        stageKey,
        label: String(stage.label ?? stageKey).trim().slice(0, 80),
        sortOrder: Number.isFinite(Number(stage.sort_order)) ? Number(stage.sort_order) : index,
        slaHours: Math.max(0, Number(stage.sla_hours ?? 0) || 0),
        ownerRole: String(stage.owner_role ?? '').trim().slice(0, 80),
        isTerminal: Boolean(stage.is_terminal),
        active: stage.active !== false,
      };
    });
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM crm_pipeline_stages WHERE pipeline_key = $1', [pipelineKey]);
      for (const stage of normalized) await this.insertPipelineStage(client, pipelineKey, stage);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.listPipelineStages(pipelineKey);
  }

  private async insertPipelineStage(
    client: PoolClient,
    pipelineKey: string,
    stage: {
      stageKey: string; label: string; sortOrder: number; slaHours: number;
      ownerRole: string; isTerminal: boolean; active: boolean;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO crm_pipeline_stages
         (pipeline_key, stage_key, label, sort_order, sla_hours, owner_role, is_terminal, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        pipelineKey, stage.stageKey, stage.label, stage.sortOrder, stage.slaHours,
        stage.ownerRole, stage.isTerminal, stage.active,
      ],
    );
  }

  getSalesPipelineConfig(): SalesPipelineConfig {
    return this.pipelineConfig;
  }

  private async refreshPipelineConfig(): Promise<void> {
    const stages = await this.listPipelineStages(DEFAULT_SALES_PIPELINE_KEY);
    this.pipelineConfig = this.buildPipelineConfig(stages);
  }

  private buildPipelineConfig(stages: PipelineStageDef[]): SalesPipelineConfig {
    const stageKeys = stages.map((stage) => stage.stage_key);
    if (!stageKeys.length) {
      return {
        pipeline_key: DEFAULT_SALES_PIPELINE_KEY,
        stages: this.fallbackPipelineStages(DEFAULT_SALES_PIPELINE_KEY),
        stage_keys: [...SALES_PIPELINE_STAGES],
        labels: { ...SALES_PIPELINE_LABELS_VI },
        sla_hours: { ...STAGE_SLA_HOURS },
        owner_roles: { ...STAGE_OWNER_ROLE },
        terminal_stages: new Set(TERMINAL_STAGES),
      };
    }
    return {
      pipeline_key: DEFAULT_SALES_PIPELINE_KEY,
      stages,
      stage_keys: stageKeys,
      labels: Object.fromEntries(stages.map((stage) => [stage.stage_key, stage.label])),
      sla_hours: Object.fromEntries(stages.map((stage) => [stage.stage_key, stage.sla_hours])),
      owner_roles: Object.fromEntries(stages.map((stage) => [stage.stage_key, stage.owner_role])),
      terminal_stages: new Set(stages.filter((stage) => stage.is_terminal).map((stage) => stage.stage_key)),
    };
  }
}
