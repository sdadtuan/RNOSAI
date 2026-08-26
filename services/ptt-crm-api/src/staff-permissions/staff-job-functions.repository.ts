import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  capsToGrantMap,
  diffGrantMaps,
  grantMapToCapRows,
  grantsToMatrix,
  normalizeGrantPayload,
} from './staff-permissions.catalog';
import {
  DEFAULT_JOB_FUNCTION_GRANTS,
  JOB_FUNCTION_CATALOG,
  type JobFunctionDef,
} from './staff-job-functions.catalog';
import type { StaffPermissionCap } from './staff-permissions.types';

export type FunctionSummary = JobFunctionDef & {
  active: boolean;
  grants_customized: boolean;
};

type DbFunctionRow = {
  code: string;
  label: string;
  description: string;
  department_scope: string;
  sort_order: number;
  active: boolean;
};

function normalizeFunctionCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}

function mapDbRow(row: DbFunctionRow): FunctionSummary {
  return {
    code: String(row.code),
    label: String(row.label ?? ''),
    description: String(row.description ?? ''),
    department_scope: String(row.department_scope ?? ''),
    sort_order: Number(row.sort_order ?? 0),
    active: Boolean(row.active),
    grants_customized: false,
  };
}

@Injectable()
export class StaffJobFunctionsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private memoryGrants = structuredClone(DEFAULT_JOB_FUNCTION_GRANTS);
  private pgReady: boolean | null = null;
  private seeded = false;

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
  }

  private async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM staff_job_functions LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private catalogFallback(): FunctionSummary[] {
    return JOB_FUNCTION_CATALOG.map((fn) => ({
      ...fn,
      active: true,
      grants_customized: false,
    }));
  }

  private async seedCatalogIfEmpty(): Promise<void> {
    if (this.seeded || !(await this.ensurePgReady())) return;
    this.seeded = true;
    const count = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM staff_job_functions`,
    );
    if (Number(count.rows[0]?.count ?? 0) > 0) return;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      for (const fn of JOB_FUNCTION_CATALOG) {
        await client.query(
          `INSERT INTO staff_job_functions (code, label, description, department_scope, active, sort_order)
           VALUES ($1, $2, $3, $4, TRUE, $5)
           ON CONFLICT (code) DO NOTHING`,
          [fn.code, fn.label, fn.description, fn.department_scope, fn.sort_order],
        );
        const grants = DEFAULT_JOB_FUNCTION_GRANTS[fn.code] ?? {};
        for (const [section_id, actions] of Object.entries(grants)) {
          for (const action of actions) {
            await client.query(
              `INSERT INTO staff_job_function_grants (function_code, section_id, action)
               VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING`,
              [fn.code, section_id, action],
            );
          }
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async loadMetaFromDb(code: string): Promise<FunctionSummary | null> {
    if (!(await this.ensurePgReady())) {
      const fn = JOB_FUNCTION_CATALOG.find((f) => f.code === code);
      if (!fn) return null;
      return { ...fn, active: true, grants_customized: false };
    }
    await this.seedCatalogIfEmpty();
    const result = await this.db.query<DbFunctionRow>(
      `SELECT code, label, description, department_scope, sort_order, active
       FROM staff_job_functions WHERE code = $1 LIMIT 1`,
      [code],
    );
    if (!result.rows[0]) return null;
    const summary = mapDbRow(result.rows[0]);
    summary.grants_customized = await this.isCustomized(code);
    return summary;
  }

  async listFunctions(): Promise<FunctionSummary[]> {
    if (!(await this.ensurePgReady())) return this.catalogFallback();
    await this.seedCatalogIfEmpty();
    const result = await this.db.query<DbFunctionRow>(
      `SELECT code, label, description, department_scope, sort_order, active
       FROM staff_job_functions
       ORDER BY active DESC, sort_order, label, code`,
    );
    const rows = await Promise.all(
      result.rows.map(async (row) => {
        const summary = mapDbRow(row);
        summary.grants_customized = await this.isCustomized(summary.code);
        return summary;
      }),
    );
    return rows.length ? rows : this.catalogFallback();
  }

  async listActiveCatalog(): Promise<Array<Pick<JobFunctionDef, 'code' | 'label' | 'description' | 'department_scope'>>> {
    const rows = await this.listFunctions();
    return rows
      .filter((fn) => fn.active)
      .map(({ code, label, description, department_scope }) => ({
        code,
        label,
        description,
        department_scope,
      }));
  }

  async listFunctionCodes(activeOnly = false): Promise<string[]> {
    const rows = await this.listFunctions();
    return rows.filter((fn) => !activeOnly || fn.active).map((fn) => fn.code);
  }

  async getFunction(
    code: string,
  ): Promise<(FunctionSummary & { grants: Record<string, string[]>; matrix: ReturnType<typeof grantsToMatrix> }) | null> {
    const meta = await this.loadMetaFromDb(code);
    if (!meta) return null;
    const grants = await this.loadGrants(code);
    const matrix = grantsToMatrix(grants);
    return { ...meta, grants, matrix };
  }

  private async isCustomized(code: string): Promise<boolean> {
    if (!(await this.ensurePgReady())) {
      const defaults = DEFAULT_JOB_FUNCTION_GRANTS[code] ?? {};
      const current = this.memoryGrants[code] ?? {};
      return JSON.stringify(defaults) !== JSON.stringify(current);
    }
    try {
      const result = await this.db.query(
        `SELECT COUNT(*)::int AS c FROM staff_job_function_grants WHERE function_code = $1`,
        [code],
      );
      return Number(result.rows[0]?.c ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async loadGrants(code: string): Promise<Record<string, string[]>> {
    if (await this.ensurePgReady()) {
      try {
        const result = await this.db.query<{ section_id: string; action: string }>(
          `SELECT section_id, action FROM staff_job_function_grants WHERE function_code = $1 ORDER BY section_id, action`,
          [code],
        );
        if (result.rowCount && result.rowCount > 0) {
          return capsToGrantMap(
            result.rows.map((row) => ({
              section_id: String(row.section_id),
              action: String(row.action),
            })),
          );
        }
      } catch {
        /* fall through */
      }
    }
    return structuredClone(this.memoryGrants[code] ?? DEFAULT_JOB_FUNCTION_GRANTS[code] ?? {});
  }

  async createFunction(
    body: {
      code: string;
      label: string;
      description?: string;
      department_scope?: string;
      sort_order?: number;
    },
    _actorEmail: string,
  ): Promise<FunctionSummary> {
    const code = normalizeFunctionCode(body.code);
    const label = String(body.label ?? '').trim();
    if (!code || !label) {
      throw new BadRequestException({ error: 'invalid_job_function', message: 'code and label required' });
    }
    if (!(await this.ensurePgReady())) {
      throw new BadRequestException({ error: 'pg_required', message: 'PostgreSQL required for job function catalog CRUD' });
    }
    await this.seedCatalogIfEmpty();

    const dup = await this.db.query(`SELECT 1 FROM staff_job_functions WHERE code = $1 LIMIT 1`, [code]);
    if (dup.rows[0]) {
      throw new ConflictException({ error: 'function_code_exists', code });
    }

    const description = String(body.description ?? '').trim();
    const department_scope = String(body.department_scope ?? 'All').trim() || 'All';
    const sort_order = Number.isFinite(body.sort_order) ? Number(body.sort_order) : 100;

    await this.db.query(
      `INSERT INTO staff_job_functions (code, label, description, department_scope, active, sort_order)
       VALUES ($1, $2, $3, $4, TRUE, $5)`,
      [code, label, description, department_scope, sort_order],
    );

    const created = await this.loadMetaFromDb(code);
    if (!created) throw new NotFoundException({ error: 'function_not_found', code });
    return created;
  }

  async updateFunctionMetadata(
    code: string,
    body: Partial<{
      label: string;
      description: string;
      department_scope: string;
      sort_order: number;
      active: boolean;
    }>,
    _actorEmail: string,
  ): Promise<FunctionSummary> {
    const existing = await this.loadMetaFromDb(code);
    if (!existing) throw new NotFoundException({ error: 'function_not_found', code });
    if (!(await this.ensurePgReady())) {
      throw new BadRequestException({ error: 'pg_required', message: 'PostgreSQL required for job function catalog CRUD' });
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) throw new BadRequestException({ error: 'invalid_label' });
      sets.push(`label = $${idx++}`);
      params.push(label);
    }
    if (body.description !== undefined) {
      sets.push(`description = $${idx++}`);
      params.push(String(body.description).trim());
    }
    if (body.department_scope !== undefined) {
      sets.push(`department_scope = $${idx++}`);
      params.push(String(body.department_scope).trim() || 'All');
    }
    if (body.sort_order !== undefined) {
      sets.push(`sort_order = $${idx++}`);
      params.push(Number(body.sort_order));
    }
    if (body.active !== undefined) {
      sets.push(`active = $${idx++}`);
      params.push(Boolean(body.active));
    }
    if (!sets.length) return existing;

    params.push(code);
    await this.db.query(
      `UPDATE staff_job_functions SET ${sets.join(', ')} WHERE code = $${idx}`,
      params,
    );

    const updated = await this.loadMetaFromDb(code);
    if (!updated) throw new NotFoundException({ error: 'function_not_found', code });
    return updated;
  }

  async deleteFunction(code: string, _actorEmail: string): Promise<{ ok: true; code: string }> {
    const existing = await this.loadMetaFromDb(code);
    if (!existing) throw new NotFoundException({ error: 'function_not_found', code });
    if (!(await this.ensurePgReady())) {
      throw new BadRequestException({ error: 'pg_required', message: 'PostgreSQL required for job function catalog CRUD' });
    }

    const usage = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM staff_user_job_functions WHERE function_code = $1`,
      [code],
    );
    const userCount = Number(usage.rows[0]?.count ?? 0);
    if (userCount > 0) {
      throw new ConflictException({
        error: 'function_in_use',
        message: 'Job function đang được gán cho nhân viên — gỡ gán hoặc ngưng thay vì xóa',
        blockers: [{ entity: 'users', count: userCount }],
      });
    }

    await this.db.query(`DELETE FROM staff_job_functions WHERE code = $1`, [code]);
    delete this.memoryGrants[code];
    return { ok: true, code };
  }

  async replaceGrants(
    code: string,
    grants: Record<string, string[]>,
    actorEmail: string,
  ): Promise<{ added: number; removed: number; diff: Record<string, unknown> }> {
    const meta = await this.loadMetaFromDb(code);
    if (!meta) throw new NotFoundException({ error: 'function_not_found', code });

    const normalized = normalizeGrantPayload(grants);
    const before = await this.loadGrants(code);
    const diff = diffGrantMaps(before, normalized);

    if (await this.ensurePgReady()) {
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM staff_job_function_grants WHERE function_code = $1`, [code]);
        const rows = grantMapToCapRows(normalized);
        for (const row of rows) {
          await client.query(
            `INSERT INTO staff_job_function_grants (function_code, section_id, action) VALUES ($1, $2, $3)`,
            [code, row.section_id, row.action],
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      this.memoryGrants[code] = normalized;
    }

    void actorEmail;
    return {
      added: Number(diff.added ?? 0),
      removed: Number(diff.removed ?? 0),
      diff,
    };
  }

  async loadCapsForFunctions(codes: string[]): Promise<StaffPermissionCap[]> {
    const caps: StaffPermissionCap[] = [];
    for (const code of codes) {
      const grants = await this.loadGrants(code);
      for (const [section_id, actions] of Object.entries(grants)) {
        for (const action of actions) {
          caps.push({ section_id, action });
        }
      }
    }
    return caps;
  }

  async loadUserFunctionCodes(userId: string): Promise<string[]> {
    if (await this.ensurePgReady()) {
      try {
        const result = await this.db.query<{ function_code: string }>(
          `SELECT ujf.function_code
           FROM staff_user_job_functions ujf
           JOIN staff_job_functions jf ON jf.code = ujf.function_code AND jf.active IS TRUE
           WHERE ujf.user_id = $1::uuid
           ORDER BY ujf.function_code`,
          [userId],
        );
        if (result.rowCount && result.rowCount > 0) {
          return result.rows.map((r) => String(r.function_code));
        }
      } catch {
        /* fall through */
      }
    }
    return [];
  }

  async replaceUserFunctions(
    userId: string,
    functionCodes: string[],
    assignedBy = '',
  ): Promise<string[]> {
    const normalized = [...new Set(functionCodes.map((c) => normalizeFunctionCode(c)).filter(Boolean))].sort();
    if (normalized.length) {
      const valid = new Set(await this.listFunctionCodes(true));
      const invalid = normalized.filter((code) => !valid.has(code));
      if (invalid.length) {
        throw new BadRequestException({
          error: 'invalid_job_functions',
          message: 'Một hoặc nhiều job function không tồn tại hoặc đã ngưng',
          invalid,
        });
      }
    }

    if (await this.ensurePgReady()) {
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM staff_user_job_functions WHERE user_id = $1::uuid`, [userId]);
        for (const code of normalized) {
          await client.query(
            `INSERT INTO staff_user_job_functions (user_id, function_code, assigned_by, assigned_at)
             VALUES ($1::uuid, $2, $3, NOW())`,
            [userId, code, assignedBy],
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    return normalized;
  }
}
