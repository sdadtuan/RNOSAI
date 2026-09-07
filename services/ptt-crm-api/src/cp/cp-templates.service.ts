import { HttpException, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CP_TENANT_ID } from './cp-audit.repository';
import { CpVideoScope, CpVideosService } from './cp-videos.service';

export const CP_TEMPLATES_QUERY = 'CP_TEMPLATES_QUERY';

export const CP_TEMPLATE_REQUIRED_VARS = [
  'project_name',
  'price_from',
  'location',
  'cta',
  'hotline',
] as const;

export type CpTemplateInput = {
  name?: string;
  variables?: unknown;
  variables_json?: unknown;
  rules_json?: unknown;
  brand_kit_id?: string | null;
};

export type CpTemplateUseInput = {
  project_id?: string;
  name?: string;
};

export interface CpTemplatesQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

const DEFAULT_SCOPE: CpVideoScope = { scope: 'all', staffId: 0, teamIds: [] };

@Injectable()
export class CpTemplatesRepository implements CpTemplatesQueryPort, OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  query(sql: string, params?: unknown[]) {
    return this.db.query(sql, params);
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }
}

@Injectable()
export class CpTemplatesService {
  constructor(
    @Inject(CP_TEMPLATES_QUERY) private readonly db: CpTemplatesQueryPort,
    private readonly videos: CpVideosService,
  ) {}

  async list() {
    const result = await this.db.query(
      `SELECT *
         FROM crm_cp_templates
        WHERE tenant_id = $1
        ORDER BY name, version DESC, id`,
      [CP_TENANT_ID],
    );
    return { items: result.rows };
  }

  async get(id: string) {
    const result = await this.db.query(
      `SELECT *
         FROM crm_cp_templates
        WHERE tenant_id = $1 AND id = $2::uuid
        LIMIT 1`,
      [CP_TENANT_ID, requiredUuid(id, 'invalid_template_id')],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  async create(input: CpTemplateInput) {
    const name = requiredText(input.name, 'name_required');
    const variables = parseVariables(input.variables ?? input.variables_json);
    assertRequiredVariables(variables);
    const result = await this.db.query(
      `INSERT INTO crm_cp_templates (
         tenant_id, name, version, variables_json, rules_json, brand_kit_id, status
       ) VALUES (
         $1, $2, 1, $3::jsonb, $4::jsonb, $5::uuid, 'draft'
       )
       RETURNING *`,
      [
        CP_TENANT_ID,
        name,
        JSON.stringify(variables),
        JSON.stringify(objectValue(input.rules_json)),
        optionalUuid(input.brand_kit_id, 'invalid_brand_kit_id'),
      ],
    );
    return result.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
  }

  async publish(id: string) {
    const current = await this.get(id);
    if (current.status === 'published') return current;
    if (current.status !== 'draft') cpThrow(409, { error: 'template_not_draft' });
    const result = await this.db.query(
      `UPDATE crm_cp_templates
          SET status = 'published'
        WHERE tenant_id = $1 AND id = $2::uuid AND status = 'draft'
        RETURNING *`,
      [CP_TENANT_ID, current.id],
    );
    return result.rows[0] ?? cpThrow(409, { error: 'template_not_draft' });
  }

  async use(
    id: string,
    input: CpTemplateUseInput,
    scope: CpVideoScope = DEFAULT_SCOPE,
  ) {
    const template = await this.get(id);
    if (template.status !== 'published') {
      cpThrow(409, { error: 'template_not_published' });
    }
    const unit = unitCredits(template.rules_json);
    return this.videos.upsertDraft({
      project_id: requiredUuid(input.project_id, 'project_id_required'),
      name: nullableText(input.name) ?? String(template.name ?? 'Template'),
      input_mode: 'template',
      config_json: {
        template_id: template.id,
        template_version: template.version ?? 1,
        variables: parseVariables(template.variables_json),
        estimated_credits: unit,
      },
      brand_kit_version_id: null,
    }, scope);
  }
}

export function parseVariables(value: unknown): string[] {
  if (value == null || value === '') return [];
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,]+/)
      : [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of list) {
    const name = String(item ?? '').trim().replace(/^\{\{|\}\}$/g, '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function assertRequiredVariables(variables: string[]): void {
  const have = new Set(variables);
  if (CP_TEMPLATE_REQUIRED_VARS.some((name) => !have.has(name))) {
    cpThrow(400, { error: 'template_variables_required' });
  }
}

export function unitCredits(rules: unknown): number {
  const obj = objectValue(rules);
  const value = obj.unit_credits ?? obj.unit;
  if (value == null || value === '') return 1;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) return 1;
  return number;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requiredText(value: unknown, error: string): string {
  const text = String(value ?? '').trim();
  if (!text) cpThrow(400, { error });
  return text;
}

function nullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function requiredUuid(value: unknown, error: string): string {
  const id = String(value ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    cpThrow(400, { error });
  }
  return id;
}

function optionalUuid(value: unknown, error: string): string | null {
  if (value == null || value === '') return null;
  return requiredUuid(value, error);
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
