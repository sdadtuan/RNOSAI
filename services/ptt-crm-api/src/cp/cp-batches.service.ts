import { HttpException, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CP_TENANT_ID } from './cp-audit.repository';
import { CpRendersService, CpRenderScope } from './cp-renders.service';
import { cpScopeSql } from './cp-scope.util';
import { expandBatchMatrix, type CpBatchMatrix } from './cp-batch-matrix.util';
import { unitCredits } from './cp-templates.service';
import { CpVideosService } from './cp-videos.service';

export const CP_BATCHES_QUERY = 'CP_BATCHES_QUERY';
export const CP_BATCH_MAX_ROWS = 50;
/** Stub unit when template.rules_json.unit_credits is absent. Not a SaaS price. */
export const CP_STUB_BATCH_UNIT_CREDITS = 1;

export const CRM_COLUMN_ALLOWLIST = [
  'clients.id',
  'clients.code',
  'clients.name',
  'clients.industry_slug',
  'clients.status',
  'clients.owner_am_id',
  'clients.notes',
  'clients.data_residency_tag',
  'service_lifecycle.id',
  'service_lifecycle.sqlite_lifecycle_id',
  'service_lifecycle.lead_id',
  'service_lifecycle.customer_id',
  'service_lifecycle.contract_id',
  'service_lifecycle.service_slug',
  'service_lifecycle.stage',
  'service_lifecycle.status',
  'service_lifecycle.assigned_am',
  'service_lifecycle.assigned_sp',
  'service_lifecycle.notes',
] as const;

const CRM_COLUMN_SET = new Set<string>(CRM_COLUMN_ALLOWLIST);

export type CpBatchScope = CpRenderScope;

export type CpBatchSource = {
  type?: string;
  client_id?: string;
  lifecycle_id?: number | string;
  columns?: string[];
};

export type CpBatchInput = {
  template_id?: string;
  project_id?: string | null;
  rows?: unknown;
  mapping?: Record<string, string>;
  source?: CpBatchSource;
  matrix?: CpBatchMatrix;
};

export type CpBatchItemPatch = {
  row_json?: unknown;
};

export interface CpBatchesQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

const DEFAULT_SCOPE: CpBatchScope = { scope: 'all', staffId: 0, teamIds: [] };

@Injectable()
export class CpBatchesRepository implements CpBatchesQueryPort, OnModuleDestroy {
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
export class CpBatchesService {
  constructor(
    @Inject(CP_BATCHES_QUERY) private readonly db: CpBatchesQueryPort,
    private readonly videos: CpVideosService,
    private readonly renders: CpRendersService,
  ) {}

  async list(scope: CpBatchScope = DEFAULT_SCOPE) {
    const allowed = projectScope(scope, 2);
    const result = await this.db.query(
      `SELECT b.*
         FROM crm_cp_batch_jobs b
         LEFT JOIN crm_cp_projects p ON p.id = b.project_id
        WHERE (b.project_id IS NULL OR (p.tenant_id = $1 AND ${allowed.sql}))
        ORDER BY b.created_at DESC, b.id DESC
        LIMIT 50`,
      [CP_TENANT_ID, ...allowed.params],
    );
    return { items: result.rows };
  }

  async get(id: string, scope: CpBatchScope = DEFAULT_SCOPE): Promise<Record<string, unknown> & {
    items: Record<string, unknown>[];
  }> {
    const batch = await this.loadBatch(id, scope);
    const items = await this.loadItems(String(batch.id));
    return { ...batch, items };
  }

  async create(
    input: CpBatchInput,
    createdBy: number,
    scope: CpBatchScope = DEFAULT_SCOPE,
  ) {
    const template = await this.loadTemplate(requiredUuid(input.template_id, 'template_id_required'));
    const mapping = objectValue(input.mapping) as Record<string, string>;
    let rows = await this.resolveRows(input, mapping);
    if (input.matrix && Object.keys(input.matrix).length) {
      const expanded = expandBatchMatrix(rows, input.matrix);
      if (expanded.length > CP_BATCH_MAX_ROWS) {
        cpThrow(400, {
          error: 'batch_matrix_too_large',
          max: CP_BATCH_MAX_ROWS,
          count: expanded.length,
          base_rows: rows.length,
        });
      }
      rows = expanded;
    } else if (rows.length > CP_BATCH_MAX_ROWS) {
      cpThrow(400, { error: 'batch_too_large' });
    }
    const projectId = optionalUuid(input.project_id, 'invalid_project_id');
    if (projectId) await this.loadProject(projectId, scope);

    const inserted = await this.db.query(
      `INSERT INTO crm_cp_batch_jobs (
         template_id, project_id, estimate_credits, status, created_by
       ) VALUES (
         $1::uuid, $2::uuid, $3, 'draft', $4
       )
       RETURNING *`,
      [template.id, projectId, null, createdBy],
    );
    const batch = inserted.rows[0] ?? cpThrow(500, { error: 'insert_failed' });
    const items: Record<string, unknown>[] = [];
    for (const [index, row] of rows.entries()) {
      const rowNo = Number(row.row_no ?? index + 1);
      const created = await this.db.query(
        `INSERT INTO crm_cp_batch_items (
           batch_id, row_no, row_json, mapping_json, status
         ) VALUES (
           $1::uuid, $2, $3::jsonb, $4::jsonb, 'pending'
         )
         RETURNING *`,
        [batch.id, rowNo, JSON.stringify(row), JSON.stringify(mapping)],
      );
      items.push(created.rows[0] ?? {
        batch_id: batch.id,
        row_no: rowNo,
        row_json: row,
        mapping_json: mapping,
        status: 'pending',
      });
    }
    return { ...batch, items };
  }

  async validate(id: string, scope: CpBatchScope = DEFAULT_SCOPE): Promise<Record<string, unknown> & {
    items: Record<string, unknown>[];
    valid_count: number;
    invalid_count: number;
    estimate_credits: number;
    unit_credits: number;
  }> {
    const batch = await this.loadBatch(id, scope);
    const template = await this.loadTemplate(String(batch.template_id));
    const required = parseVarNames(template.variables_json);
    const items = await this.loadItems(String(batch.id));
    let validCount = 0;
    let invalidCount = 0;
    for (const item of items) {
      if (item.status === 'completed' || item.status === 'submitted') {
        validCount += 1;
        continue;
      }
      const mapping = asMapping(item.mapping_json);
      const row = objectValue(item.row_json);
      const result = validateBatchRow(row, required, mapping);
      await this.db.query(
        `UPDATE crm_cp_batch_items
            SET status = $1, error = $2, job_id = $3
          WHERE batch_id = $4::uuid AND row_no = $5
          RETURNING *`,
        [result.status, result.error, item.job_id ?? null, batch.id, item.row_no],
      );
      item.status = result.status;
      item.error = result.error;
      if (result.status === 'valid') validCount += 1;
      else invalidCount += 1;
    }
    const unit = unitCredits(template.rules_json) || CP_STUB_BATCH_UNIT_CREDITS;
    const estimate = estimateBatchCredits(validCount, unit);
    await this.db.query(
      `UPDATE crm_cp_batch_jobs
          SET estimate_credits = $1
        WHERE id = $2::uuid
        RETURNING *`,
      [estimate, batch.id],
    );
    batch.estimate_credits = estimate;
    return {
      ...batch,
      items,
      valid_count: validCount,
      invalid_count: invalidCount,
      estimate_credits: estimate,
      unit_credits: unit,
    } as Record<string, unknown> & {
      items: Record<string, unknown>[];
      valid_count: number;
      invalid_count: number;
      estimate_credits: number;
      unit_credits: number;
    };
  }

  async run(id: string, scope: CpBatchScope = DEFAULT_SCOPE) {
    const validated = await this.validate(id, scope);
    const items = Array.isArray(validated.items) ? validated.items : [];
    const results: Record<string, unknown>[] = [];
    for (const item of items) {
      if (item.status === 'completed' || item.status === 'submitted') {
        results.push(item);
        continue;
      }
      if (item.status !== 'valid' && item.status !== 'failed') {
        results.push(item);
        continue;
      }
      results.push(await this.renderItem(validated, item, scope));
    }
    await this.db.query(
      `UPDATE crm_cp_batch_jobs
          SET status = $1
        WHERE id = $2::uuid
        RETURNING *`,
      ['running', validated.id],
    );
    return { ...validated, items: results, status: 'running' };
  }

  async patchItem(
    id: string,
    rowNo: number | string,
    input: CpBatchItemPatch,
    scope: CpBatchScope = DEFAULT_SCOPE,
  ) {
    const batch = await this.get(id, scope);
    const n = Number(rowNo);
    const item = (batch.items as Record<string, unknown>[]).find((row) => Number(row.row_no) === n)
      ?? cpThrow(404, { error: 'not_found' });
    if (item.status === 'completed') cpThrow(409, { error: 'item_not_patchable' });
    const next = { ...objectValue(item.row_json), ...objectValue(input.row_json) };
    await this.db.query(
      `UPDATE crm_cp_batch_items
          SET row_json = $1::jsonb
        WHERE batch_id = $2::uuid AND row_no = $3
        RETURNING *`,
      [JSON.stringify(next), batch.id, n],
    );
    item.row_json = next;
    const template = await this.loadTemplate(String(batch.template_id));
    const checked = validateBatchRow(
      next,
      parseVarNames(template.variables_json),
      asMapping(item.mapping_json),
    );
    await this.db.query(
      `UPDATE crm_cp_batch_items
          SET status = $1, error = $2
        WHERE batch_id = $3::uuid AND row_no = $4
        RETURNING *`,
      [checked.status, checked.error, batch.id, n],
    );
    item.status = checked.status;
    item.error = checked.error;
    return item;
  }

  async retryItem(id: string, rowNo: number | string, scope: CpBatchScope = DEFAULT_SCOPE) {
    const batch = await this.get(id, scope);
    const n = Number(rowNo);
    const item = (batch.items as Record<string, unknown>[]).find((row) => Number(row.row_no) === n)
      ?? cpThrow(404, { error: 'not_found' });
    if (item.status === 'completed') return item;
    if (item.status === 'submitted') return item;
    if (item.status === 'invalid') {
      const template = await this.loadTemplate(String(batch.template_id));
      const checked = validateBatchRow(
        objectValue(item.row_json),
        parseVarNames(template.variables_json),
        asMapping(item.mapping_json),
      );
      if (checked.status === 'invalid') {
        item.status = checked.status;
        item.error = checked.error;
        return item;
      }
      item.status = 'valid';
      item.error = null;
    }
    const jobId = nullableText(item.job_id);
    if (jobId) {
      const job = await this.renders.retryJob(jobId, scope);
      applyJobState(item, job, jobId);
      await this.db.query(
        `UPDATE crm_cp_batch_items
            SET status = $1, error = $2, job_id = $3
          WHERE batch_id = $4::uuid AND row_no = $5
          RETURNING *`,
        [item.status, item.error, item.job_id, batch.id, item.row_no],
      );
      return item;
    }
    return this.renderItem(batch, item, scope);
  }

  async errorsCsv(id: string, scope: CpBatchScope = DEFAULT_SCOPE) {
    const batch = await this.get(id, scope);
    const items = (batch.items as Record<string, unknown>[]).filter((item) => (
      item.status === 'invalid' || item.status === 'failed'
    ));
    const header = ['row_no', 'status', 'error'];
    const lines = [header.join(',')];
    for (const item of items) {
      lines.push([
        csvCell(item.row_no),
        csvCell(item.status),
        csvCell(item.error),
      ].join(','));
    }
    return `${lines.join('\n')}\n`;
  }

  private async renderItem(
    batch: Record<string, unknown>,
    item: Record<string, unknown>,
    scope: CpBatchScope,
  ) {
    const key = batchIdempotencyKey(String(batch.id), Number(item.row_no));
    const row = objectValue(item.row_json);
    const template = await this.loadTemplate(String(batch.template_id));
    const unit = unitCredits(template.rules_json) || CP_STUB_BATCH_UNIT_CREDITS;
    const projectId = optionalUuid(batch.project_id, 'invalid_project_id')
      ?? requiredUuid(row.project_id, 'project_id_required');
    try {
      const draft = await this.videos.upsertDraft({
        project_id: projectId,
        name: String(row.project_name ?? template.name ?? 'Batch'),
        input_mode: 'template',
        config_json: {
          template_id: template.id,
          batch_id: batch.id,
          row_no: item.row_no,
          estimated_credits: unit,
          variables: row,
          ratio: nullableText(row.ratio),
          locale: nullableText(row.locale),
          channel: nullableText(row.channel),
          variant_key: nullableText(row.variant_key),
        },
      }, scope);
      const submitted = await this.renders.submit(String(draft.id), key, scope, {
        batchItemId: nullableText(item.id),
      });
      const submittedId = nullableText(submitted.job_id ?? submitted.id);
      const job = submittedId && isUnsuccessfulRender(submitted)
        ? await this.renders.retryJob(submittedId, scope)
        : submitted;
      applyJobState(item, job);
      item.draft_id = draft.id;
      await this.db.query(
        `UPDATE crm_cp_batch_items
            SET status = $1, error = $2, job_id = $3
          WHERE batch_id = $4::uuid AND row_no = $5
          RETURNING *`,
        [item.status, item.error, item.job_id, batch.id, item.row_no],
      );
      return item;
    } catch (error) {
      const message = errorBody(error);
      item.status = 'failed';
      item.error = message;
      await this.db.query(
        `UPDATE crm_cp_batch_items
            SET status = $1, error = $2, job_id = $3
          WHERE batch_id = $4::uuid AND row_no = $5
          RETURNING *`,
        ['failed', message, item.job_id ?? null, batch.id, item.row_no],
      );
      return item;
    }
  }

  private async resolveRows(
    input: CpBatchInput,
    mapping: Record<string, string>,
  ): Promise<Record<string, unknown>[]> {
    const raw = Array.isArray(input.rows) ? input.rows : [];
    const rows = raw.map((item, index) => {
      const row = objectValue(item);
      return { row_no: index + 1, ...row };
    });
    const source = input.source ?? {};
    for (const value of Object.values(mapping)) {
      if (isCrmRef(value)) assertCrmColumn(value);
    }
    if (Array.isArray(source.columns)) {
      for (const column of source.columns) {
        if (isCrmRef(column)) assertCrmColumn(column);
      }
    }
    const wantsCrm = source.type === 'crm'
      || Object.values(mapping).some(isCrmRef)
      || (source.columns ?? []).some(isCrmRef);
    if (wantsCrm) {
      const fetched = await this.fetchCrmRow(source, mapping);
      if (fetched) {
        if (!rows.length) {
          rows.push({ row_no: 1, ...fetched });
        } else {
          for (const row of rows) mergeCrmIntoRow(row, fetched, mapping);
        }
      }
    }
    return rows;
  }

  private async fetchCrmRow(
    source: CpBatchSource,
    mapping: Record<string, string>,
  ): Promise<Record<string, unknown> | null> {
    const refs = [
      ...Object.values(mapping).filter(isCrmRef),
      ...(source.columns ?? []).filter(isCrmRef),
    ].map((ref) => resolveCrmRef(ref));
    const row: Record<string, unknown> = {};
    const clientRefs = refs.filter((ref) => ref.table === 'clients');
    const lifecycleRefs = refs.filter((ref) => ref.table === 'crm_service_lifecycle');
    if (clientRefs.length && source.client_id) {
      const columns = clientRefs.map((ref) => `${ref.column} AS "${ref.key}"`).join(', ');
      const result = await this.db.query(
        `SELECT ${columns} FROM clients WHERE id = $1::uuid LIMIT 1`,
        [requiredUuid(source.client_id, 'invalid_client_id')],
      );
      Object.assign(row, result.rows[0] ?? {});
    }
    if (lifecycleRefs.length && source.lifecycle_id != null && source.lifecycle_id !== '') {
      const columns = lifecycleRefs.map((ref) => `${ref.column} AS "${ref.key}"`).join(', ');
      const result = await this.db.query(
        `SELECT ${columns} FROM crm_service_lifecycle WHERE id = $1 LIMIT 1`,
        [Number(source.lifecycle_id)],
      );
      Object.assign(row, result.rows[0] ?? {});
    }
    const mapped: Record<string, unknown> = { ...row };
    for (const [variable, sourceKey] of Object.entries(mapping)) {
      if (isCrmRef(sourceKey)) mapped[variable] = row[normalizeCrmRef(sourceKey)] ?? row[variable];
    }
    return Object.keys(mapped).length ? mapped : null;
  }

  private async loadTemplate(id: string) {
    const result = await this.db.query(
      `SELECT * FROM crm_cp_templates WHERE id = $1::uuid LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'template_not_found' });
  }

  private async loadProject(id: string, scope: CpBatchScope) {
    const allowed = projectScope(scope, 3);
    const result = await this.db.query(
      `SELECT * FROM crm_cp_projects p
        WHERE p.tenant_id = $1 AND p.id = $2::uuid AND ${allowed.sql}
        LIMIT 1`,
      [CP_TENANT_ID, id, ...allowed.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  private async loadBatch(id: string, scope: CpBatchScope) {
    const allowed = projectScope(scope, 3);
    const result = await this.db.query(
      `SELECT b.*
         FROM crm_cp_batch_jobs b
         LEFT JOIN crm_cp_projects p ON p.id = b.project_id
        WHERE b.id = $1::uuid
          AND (b.project_id IS NULL OR (p.tenant_id = $2 AND ${allowed.sql}))
        LIMIT 1`,
      [requiredUuid(id, 'invalid_batch_id'), CP_TENANT_ID, ...allowed.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  private async loadItems(batchId: string) {
    const result = await this.db.query(
      `SELECT * FROM crm_cp_batch_items WHERE batch_id = $1::uuid ORDER BY row_no`,
      [batchId],
    );
    return result.rows;
  }
}

export function batchIdempotencyKey(batchId: string, rowNo: number): string {
  return `${batchId}:${rowNo}`;
}

export function estimateBatchCredits(
  validCount: number,
  unit = CP_STUB_BATCH_UNIT_CREDITS,
): number {
  return validCount * unit;
}

export function validateBatchRow(
  row: Record<string, unknown>,
  required: string[],
  mapping: Record<string, string>,
): { status: 'valid' | 'invalid'; error: string | null } {
  for (const variable of required) {
    const source = mapping[variable] ?? variable;
    const value = row[source] ?? row[variable] ?? row[normalizeCrmRef(source)];
    if (value == null || String(value).trim() === '') {
      return { status: 'invalid', error: 'missing_mapped_required' };
    }
  }
  return { status: 'valid', error: null };
}

export function assertCrmColumn(ref: string): { table: 'clients' | 'crm_service_lifecycle'; column: string; key: string } {
  return resolveCrmRef(ref);
}

function isUnsuccessfulRender(job: Record<string, unknown>): boolean {
  return ['failed', 'cancelled', 'expired'].includes(String(job.state ?? job.status ?? ''));
}

function applyJobState(
  item: Record<string, unknown>,
  job: Record<string, unknown>,
  fallbackJobId?: string | null,
) {
  const jobId = nullableText(job.job_id ?? job.id) ?? fallbackJobId ?? null;
  const state = String(job.state ?? job.status ?? '');
  item.job_id = jobId;
  if (state === 'completed') {
    item.status = 'completed';
    item.error = null;
    return;
  }
  if (isUnsuccessfulRender(job)) {
    item.status = 'failed';
    item.error = nullableText(job.error_class ?? job.error ?? job.last_error) ?? 'render_failed';
    return;
  }
  item.status = 'submitted';
  item.error = null;
}

function mergeCrmIntoRow(
  row: Record<string, unknown>,
  fetched: Record<string, unknown>,
  mapping: Record<string, string>,
) {
  for (const [variable, sourceKey] of Object.entries(mapping)) {
    if (!isCrmRef(sourceKey)) continue;
    const key = normalizeCrmRef(sourceKey);
    const value = fetched[variable] ?? fetched[key];
    if (value == null || String(value).trim() === '') continue;
    row[variable] = value;
    row[key] = fetched[key] ?? value;
  }
}

function isCrmRef(value: string): boolean {
  return /^(clients|service_lifecycle|crm_service_lifecycle)\./i.test(String(value ?? '').trim());
}

function normalizeCrmRef(ref: string): string {
  return String(ref ?? '')
    .trim()
    .toLowerCase()
    .replace(/^crm_service_lifecycle\./, 'service_lifecycle.');
}

function resolveCrmRef(ref: string): { table: 'clients' | 'crm_service_lifecycle'; column: string; key: string } {
  const key = normalizeCrmRef(ref);
  if (!CRM_COLUMN_SET.has(key)) cpThrow(400, { error: 'unknown_crm_column', column: ref });
  const [tableName, column] = key.split('.');
  return {
    table: tableName === 'clients' ? 'clients' : 'crm_service_lifecycle',
    column,
    key,
  };
}

function parseVarNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).replace(/^\{\{|\}\}$/g, '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      return parseVarNames(JSON.parse(value));
    } catch {
      return value.split(/[\s,]+/).map((item) => item.replace(/^\{\{|\}\}$/g, '').trim()).filter(Boolean);
    }
  }
  return [];
}

function asMapping(value: unknown): Record<string, string> {
  const obj = objectValue(value);
  return Object.fromEntries(
    Object.entries(obj).map(([key, item]) => [key, String(item)]),
  );
}

function projectScope(scope: CpBatchScope, startAt: number) {
  const raw = cpScopeSql({
    scope: scope.scope,
    staffId: scope.staffId,
    teamIds: scope.teamIds ?? [],
  });
  const token = raw.sql.includes('$teams') ? '$teams' : '$staff';
  return {
    sql: raw.sql.replaceAll(token, `$${startAt}`),
    params: raw.params,
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return objectValue(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value as Record<string, unknown> }
    : {};
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function errorBody(error: unknown): string {
  if (error && typeof error === 'object') {
    const obj = error as { error?: unknown; response?: { error?: unknown }; message?: unknown };
    if (obj.response?.error) return String(obj.response.error);
    if (obj.error) return String(obj.error);
    if (obj.message) return String(obj.message);
  }
  return 'render_failed';
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

function nullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
