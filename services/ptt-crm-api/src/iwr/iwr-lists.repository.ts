import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { IWR_TENANT_ID, type IwrListKind, type IwrListRow } from './iwr.types';

function text(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

function mapList(row: Record<string, unknown>): IwrListRow {
  return {
    id: text(row.id),
    code: text(row.code),
    name_vi: text(row.name_vi),
    owner_staff_id: Number(row.owner_staff_id),
    kind: text(row.kind) as IwrListKind,
    rule_json: (row.rule_json as Record<string, unknown>) ?? {},
    active: Boolean(row.active),
  };
}

@Injectable()
export class IwrListsRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

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

  async list(): Promise<IwrListRow[]> {
    const res = await this.db.query(
      `SELECT * FROM iwr_distribution_lists
        WHERE tenant_id = $1
        ORDER BY name_vi`,
      [IWR_TENANT_ID],
    );
    return res.rows.map(mapList);
  }

  async getById(id: string): Promise<IwrListRow | null> {
    const res = await this.db.query(
      `SELECT * FROM iwr_distribution_lists WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [IWR_TENANT_ID, id],
    );
    return res.rows[0] ? mapList(res.rows[0]) : null;
  }

  async insert(input: {
    code: string;
    name_vi: string;
    owner_staff_id: number;
    kind: IwrListKind;
    rule_json: Record<string, unknown>;
    active: boolean;
  }): Promise<IwrListRow> {
    const res = await this.db.query(
      `INSERT INTO iwr_distribution_lists (
         tenant_id, code, name_vi, owner_staff_id, kind, rule_json, active
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING *`,
      [
        IWR_TENANT_ID,
        input.code,
        input.name_vi,
        input.owner_staff_id,
        input.kind,
        JSON.stringify(input.rule_json),
        input.active,
      ],
    );
    return mapList(res.rows[0]);
  }

  async update(
    id: string,
    patch: Partial<Pick<IwrListRow, 'name_vi' | 'rule_json' | 'active'>>,
  ): Promise<IwrListRow | null> {
    const sets = ['updated_at = NOW()'];
    const params: unknown[] = [IWR_TENANT_ID, id];
    let idx = 3;
    if (patch.name_vi !== undefined) {
      sets.push(`name_vi = $${idx++}`);
      params.push(patch.name_vi);
    }
    if (patch.rule_json !== undefined) {
      sets.push(`rule_json = $${idx++}::jsonb`);
      params.push(JSON.stringify(patch.rule_json));
    }
    if (patch.active !== undefined) {
      sets.push(`active = $${idx++}`);
      params.push(patch.active);
    }
    const res = await this.db.query(
      `UPDATE iwr_distribution_lists SET ${sets.join(', ')}
        WHERE tenant_id = $1 AND id = $2
        RETURNING *`,
      params,
    );
    return res.rows[0] ? mapList(res.rows[0]) : null;
  }

  async listMemberIds(listId: string): Promise<number[]> {
    const res = await this.db.query(
      `SELECT staff_id FROM iwr_list_members WHERE list_id = $1 ORDER BY staff_id`,
      [listId],
    );
    return res.rows.map((r) => Number(r.staff_id));
  }

  async addMember(listId: string, staffId: number): Promise<void> {
    await this.db.query(
      `INSERT INTO iwr_list_members (list_id, staff_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [listId, staffId],
    );
  }

  async resolveDepartmentMembers(departmentId: number): Promise<number[]> {
    const res = await this.db.query(
      `SELECT id FROM crm_staff WHERE active = TRUE AND department_id = $1 ORDER BY id`,
      [departmentId],
    );
    return res.rows.map((r) => Number(r.id));
  }
}
