import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  SALES_PIPELINE_LABELS_VI,
  SALES_PIPELINE_STAGES,
  STAGE_OWNER_ROLE,
  STAGE_SLA_HOURS,
  TERMINAL_STAGES,
} from '../sales/sales-pipeline.util';
import { DEFAULT_SALES_PIPELINE_KEY, defaultSalesPipelineStages, DEFAULT_LEAD_CHANNELS, DEFAULT_LEAD_SOURCES } from './crm-config.defaults';
import type {
  CreateCustomFieldBody,
  CreateLeadLookupBody,
  CustomFieldDef,
  CustomFieldEntityType,
  CustomFieldType,
  LeadLookupKind,
  LeadLookupOption,
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
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

@Injectable()
export class CrmConfigSqliteRepository implements OnModuleDestroy {
  private db: DatabaseSync | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get database(): DatabaseSync {
    if (!this.db) {
      this.db = new DatabaseSync(this.config.sqlitePath);
      this.db.exec('PRAGMA foreign_keys = ON');
      this.ensureSchema();
    }
    return this.db;
  }

  onModuleDestroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private ensureSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS crm_custom_field_defs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        field_key TEXT NOT NULL,
        label TEXT NOT NULL,
        field_type TEXT NOT NULL DEFAULT 'text',
        options_json TEXT NOT NULL DEFAULT '[]',
        required INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT '',
        UNIQUE(entity_type, field_key)
      );

      CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pipeline_key TEXT NOT NULL DEFAULT 'sales',
        stage_key TEXT NOT NULL,
        label TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        sla_hours INTEGER NOT NULL DEFAULT 0,
        owner_role TEXT NOT NULL DEFAULT '',
        is_terminal INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT '',
        UNIQUE(pipeline_key, stage_key)
      );

      CREATE TABLE IF NOT EXISTS crm_lead_lookup_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        option_key TEXT NOT NULL,
        label TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT '',
        UNIQUE(kind, option_key)
      );
    `);
    this.seedDefaultPipelineIfEmpty();
    this.seedDefaultLeadLookupsIfEmpty();
  }

  private seedDefaultPipelineIfEmpty(): void {
    const row = this.database
      .prepare(
        `SELECT COUNT(*) AS n FROM crm_pipeline_stages WHERE pipeline_key = ? AND active = 1`,
      )
      .get(DEFAULT_SALES_PIPELINE_KEY) as unknown as { n: number } | undefined;
    if (Number(row?.n ?? 0) > 0) return;
    const ts = catalogTs();
    const insert = this.database.prepare(
      `INSERT INTO crm_pipeline_stages
        (pipeline_key, stage_key, label, sort_order, sla_hours, owner_role, is_terminal, active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    );
    for (const stage of defaultSalesPipelineStages()) {
      insert.run(
        DEFAULT_SALES_PIPELINE_KEY,
        stage.stage_key,
        stage.label,
        stage.sort_order,
        stage.sla_hours,
        stage.owner_role,
        stage.is_terminal ? 1 : 0,
        ts,
      );
    }
  }

  private seedDefaultLeadLookupsIfEmpty(): void {
    for (const kind of ['source', 'channel'] as LeadLookupKind[]) {
      const row = this.database
        .prepare(`SELECT COUNT(*) AS n FROM crm_lead_lookup_options WHERE kind = ?`)
        .get(kind) as unknown as { n: number } | undefined;
      if (Number(row?.n ?? 0) > 0) continue;
      const ts = catalogTs();
      const insert = this.database.prepare(
        `INSERT INTO crm_lead_lookup_options
          (kind, option_key, label, sort_order, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
      );
      const defaults = kind === 'source' ? DEFAULT_LEAD_SOURCES : DEFAULT_LEAD_CHANNELS;
      defaults.forEach((item, index) => {
        insert.run(kind, item.option_key, item.label, index, ts, ts);
      });
    }
  }

  private mapLeadLookup(row: Record<string, unknown>): LeadLookupOption {
    return {
      id: Number(row.id),
      kind: String(row.kind) as LeadLookupKind,
      option_key: String(row.option_key),
      label: String(row.label),
      sort_order: Number(row.sort_order ?? 0),
      active: Number(row.active ?? 1) === 1,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  listLeadLookups(kind?: LeadLookupKind, activeOnly = false): LeadLookupOption[] {
    const params: Array<string | number> = [];
    const clauses: string[] = [];
    if (kind) {
      if (!LEAD_LOOKUP_KINDS.has(kind)) {
        throw new BadRequestException({ error: 'invalid_lookup_kind' });
      }
      clauses.push('kind = ?');
      params.push(kind);
    }
    if (activeOnly) {
      clauses.push('active = 1');
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.database
      .prepare(`SELECT * FROM crm_lead_lookup_options${where} ORDER BY kind ASC, sort_order ASC, id ASC`)
      .all(...params) as unknown as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapLeadLookup(row));
  }

  createLeadLookup(body: CreateLeadLookupBody): LeadLookupOption {
    const kind = String(body.kind ?? '').trim() as LeadLookupKind;
    if (!LEAD_LOOKUP_KINDS.has(kind)) {
      throw new BadRequestException({ error: 'invalid_lookup_kind' });
    }
    const optionKey = slugKey(String(body.option_key ?? body.label ?? ''));
    if (!optionKey) throw new BadRequestException({ error: 'invalid_option_key' });
    const label = String(body.label ?? optionKey).trim().slice(0, 120);
    const ts = catalogTs();
    try {
      const result = this.database
        .prepare(
          `INSERT INTO crm_lead_lookup_options
            (kind, option_key, label, sort_order, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          kind,
          optionKey,
          label,
          Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 999,
          body.active === false ? 0 : 1,
          ts,
          ts,
        );
      const row = this.database
        .prepare('SELECT * FROM crm_lead_lookup_options WHERE id = ?')
        .get(Number(result.lastInsertRowid)) as unknown as Record<string, unknown>;
      return this.mapLeadLookup(row);
    } catch (err) {
      if (String(err).includes('UNIQUE')) {
        throw new BadRequestException({ error: 'duplicate_option_key' });
      }
      throw err;
    }
  }

  updateLeadLookup(id: number, body: UpdateLeadLookupBody): LeadLookupOption {
    const existing = this.database
      .prepare('SELECT * FROM crm_lead_lookup_options WHERE id = ?')
      .get(id) as unknown as Record<string, unknown> | undefined;
    if (!existing) throw new NotFoundException({ error: 'lead_lookup_not_found' });

    const label =
      body.label !== undefined ? String(body.label).trim().slice(0, 120) : String(existing.label);
    const sortOrder =
      body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))
        ? Number(body.sort_order)
        : Number(existing.sort_order ?? 0);
    const active = body.active !== undefined ? (body.active ? 1 : 0) : Number(existing.active ?? 1);
    const ts = catalogTs();

    this.database
      .prepare(
        `UPDATE crm_lead_lookup_options
         SET label = ?, sort_order = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(label, sortOrder, active, ts, id);

    const row = this.database
      .prepare('SELECT * FROM crm_lead_lookup_options WHERE id = ?')
      .get(id) as unknown as Record<string, unknown>;
    return this.mapLeadLookup(row);
  }

  deleteLeadLookup(id: number): { ok: true; id: number } {
    const result = this.database.prepare('DELETE FROM crm_lead_lookup_options WHERE id = ?').run(id);
    if (Number(result.changes ?? 0) === 0) {
      throw new NotFoundException({ error: 'lead_lookup_not_found' });
    }
    return { ok: true, id };
  }

  private mapCustomField(row: Record<string, unknown>): CustomFieldDef {
    let options: string[] = [];
    try {
      const parsed = JSON.parse(String(row.options_json ?? '[]'));
      if (Array.isArray(parsed)) options = parsed.map((v) => String(v));
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
      required: Number(row.required ?? 0) === 1,
      sort_order: Number(row.sort_order ?? 0),
      active: Number(row.active ?? 1) === 1,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
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
      is_terminal: Number(row.is_terminal ?? 0) === 1,
      active: Number(row.active ?? 1) === 1,
      updated_at: String(row.updated_at ?? ''),
    };
  }

  listCustomFields(entityType?: string): CustomFieldDef[] {
    const params: string[] = [];
    let sql = 'SELECT * FROM crm_custom_field_defs';
    if (entityType) {
      if (!ENTITY_TYPES.has(entityType as CustomFieldEntityType)) {
        throw new BadRequestException({ error: 'invalid_entity_type' });
      }
      sql += ' WHERE entity_type = ?';
      params.push(entityType);
    }
    sql += ' ORDER BY entity_type ASC, sort_order ASC, id ASC';
    const rows = this.database.prepare(sql).all(...params) as unknown as Array<
      Record<string, unknown>
    >;
    return rows.map((row) => this.mapCustomField(row));
  }

  createCustomField(body: CreateCustomFieldBody): CustomFieldDef {
    const entityType = String(body.entity_type ?? '').trim() as CustomFieldEntityType;
    if (!ENTITY_TYPES.has(entityType)) {
      throw new BadRequestException({ error: 'invalid_entity_type' });
    }
    const fieldKey = slugKey(String(body.field_key ?? body.label ?? ''));
    if (!fieldKey) throw new BadRequestException({ error: 'invalid_field_key' });
    const label = String(body.label ?? fieldKey).trim().slice(0, 120);
    const fieldType = (String(body.field_type ?? 'text').trim() as CustomFieldType) || 'text';
    if (!FIELD_TYPES.has(fieldType)) {
      throw new BadRequestException({ error: 'invalid_field_type' });
    }
    const options = Array.isArray(body.options)
      ? body.options.map((v) => String(v).trim()).filter(Boolean).slice(0, 50)
      : [];
    const ts = catalogTs();
    try {
      const result = this.database
        .prepare(
          `INSERT INTO crm_custom_field_defs
            (entity_type, field_key, label, field_type, options_json, required, sort_order, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          entityType,
          fieldKey,
          label,
          fieldType,
          JSON.stringify(options),
          body.required ? 1 : 0,
          Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
          body.active === false ? 0 : 1,
          ts,
          ts,
        );
      const row = this.database
        .prepare('SELECT * FROM crm_custom_field_defs WHERE id = ?')
        .get(Number(result.lastInsertRowid)) as unknown as Record<string, unknown>;
      return this.mapCustomField(row);
    } catch (err) {
      if (String(err).includes('UNIQUE')) {
        throw new BadRequestException({ error: 'duplicate_field_key' });
      }
      throw err;
    }
  }

  updateCustomField(id: number, body: UpdateCustomFieldBody): CustomFieldDef {
    const existing = this.database
      .prepare('SELECT * FROM crm_custom_field_defs WHERE id = ?')
      .get(id) as unknown as Record<string, unknown> | undefined;
    if (!existing) throw new NotFoundException({ error: 'custom_field_not_found' });

    const label =
      body.label !== undefined ? String(body.label).trim().slice(0, 120) : String(existing.label);
    const fieldType =
      body.field_type !== undefined
        ? (String(body.field_type).trim() as CustomFieldType)
        : (String(existing.field_type) as CustomFieldType);
    if (!FIELD_TYPES.has(fieldType)) {
      throw new BadRequestException({ error: 'invalid_field_type' });
    }
    const options =
      body.options !== undefined
        ? body.options.map((v) => String(v).trim()).filter(Boolean).slice(0, 50)
        : JSON.parse(String(existing.options_json ?? '[]'));
    const required = body.required !== undefined ? (body.required ? 1 : 0) : Number(existing.required);
    const sortOrder =
      body.sort_order !== undefined && Number.isFinite(Number(body.sort_order))
        ? Number(body.sort_order)
        : Number(existing.sort_order ?? 0);
    const active = body.active !== undefined ? (body.active ? 1 : 0) : Number(existing.active ?? 1);
    const ts = catalogTs();

    this.database
      .prepare(
        `UPDATE crm_custom_field_defs
         SET label = ?, field_type = ?, options_json = ?, required = ?, sort_order = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(label, fieldType, JSON.stringify(options), required, sortOrder, active, ts, id);

    const row = this.database
      .prepare('SELECT * FROM crm_custom_field_defs WHERE id = ?')
      .get(id) as unknown as Record<string, unknown>;
    return this.mapCustomField(row);
  }

  deleteCustomField(id: number): { ok: true; id: number } {
    const result = this.database.prepare('DELETE FROM crm_custom_field_defs WHERE id = ?').run(id);
    if (Number(result.changes ?? 0) === 0) {
      throw new NotFoundException({ error: 'custom_field_not_found' });
    }
    return { ok: true, id };
  }

  listPipelineStages(pipelineKey = DEFAULT_SALES_PIPELINE_KEY): PipelineStageDef[] {
    const rows = this.database
      .prepare(
        `SELECT * FROM crm_pipeline_stages
         WHERE pipeline_key = ? AND active = 1
         ORDER BY sort_order ASC, id ASC`,
      )
      .all(pipelineKey) as unknown as Array<Record<string, unknown>>;
    if (!rows.length) return this.fallbackPipelineStages(pipelineKey);
    return rows.map((row) => this.mapPipelineStage(row));
  }

  private fallbackPipelineStages(pipelineKey: string): PipelineStageDef[] {
    const ts = catalogTs();
    return defaultSalesPipelineStages().map((stage, index) => ({
      id: index + 1,
      pipeline_key: pipelineKey,
      updated_at: ts,
      ...stage,
    }));
  }

  replacePipelineStages(
    pipelineKey: string,
    body: UpdatePipelineStagesBody,
  ): PipelineStageDef[] {
    if (!Array.isArray(body.stages) || !body.stages.length) {
      throw new BadRequestException({ error: 'stages_required' });
    }
    const ts = catalogTs();
    const normalized = body.stages.map((stage, index) => {
      const stageKey = slugKey(String(stage.stage_key ?? stage.label ?? ''));
      if (!stageKey) throw new BadRequestException({ error: 'invalid_stage_key' });
      return {
        stage_key: stageKey,
        label: String(stage.label ?? stageKey).trim().slice(0, 80),
        sort_order: Number.isFinite(Number(stage.sort_order)) ? Number(stage.sort_order) : index,
        sla_hours: Math.max(0, Number(stage.sla_hours ?? 0) || 0),
        owner_role: String(stage.owner_role ?? '').trim().slice(0, 80),
        is_terminal: stage.is_terminal ? 1 : 0,
        active: stage.active === false ? 0 : 1,
      };
    });

    const tx = this.database.prepare('BEGIN');
    const commit = this.database.prepare('COMMIT');
    const rollback = this.database.prepare('ROLLBACK');
    tx.run();
    try {
      this.database
        .prepare('DELETE FROM crm_pipeline_stages WHERE pipeline_key = ?')
        .run(pipelineKey);
      const insert = this.database.prepare(
        `INSERT INTO crm_pipeline_stages
          (pipeline_key, stage_key, label, sort_order, sla_hours, owner_role, is_terminal, active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const stage of normalized) {
        insert.run(
          pipelineKey,
          stage.stage_key,
          stage.label,
          stage.sort_order,
          stage.sla_hours,
          stage.owner_role,
          stage.is_terminal,
          stage.active,
          ts,
        );
      }
      commit.run();
    } catch (err) {
      rollback.run();
      throw err;
    }
    return this.listPipelineStages(pipelineKey);
  }

  getSalesPipelineConfig(): SalesPipelineConfig {
    const stages = this.listPipelineStages(DEFAULT_SALES_PIPELINE_KEY);
    const stageKeys = stages.map((s) => s.stage_key);
    const labels = Object.fromEntries(stages.map((s) => [s.stage_key, s.label]));
    const slaHours = Object.fromEntries(stages.map((s) => [s.stage_key, s.sla_hours]));
    const ownerRoles = Object.fromEntries(stages.map((s) => [s.stage_key, s.owner_role]));
    const terminalStages = new Set(stages.filter((s) => s.is_terminal).map((s) => s.stage_key));

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
      labels,
      sla_hours: slaHours,
      owner_roles: ownerRoles,
      terminal_stages: terminalStages,
    };
  }
}
