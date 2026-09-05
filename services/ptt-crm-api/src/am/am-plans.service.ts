import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { AM_TENANT_ID } from './am-audit.repository';
import { AmDashboardService } from './am-dashboard.service';
import { amThrow } from './am-http';
import { AmTasksService, isUuid } from './am-tasks.service';
import type { AmPlanKind } from './am.types';

export type AmCreatePlanInput = {
  agency_client_id: string;
  kind: AmPlanKind;
  period_key: string;
  contract_id?: number;
  due_on?: string;
};

export type AmPlanRow = {
  id: string;
  agency_client_id: string;
  contract_id: number | null;
  kind: AmPlanKind;
  period_key: string;
  status: string;
  owner_staff_id: number;
  due_on: string | null;
};

export type AmPlansStore = {
  insert(input: AmCreatePlanInput & { owner_staff_id: number }): Promise<AmPlanRow>;
  deleteById(id: string): Promise<void>;
};

const PLAN_KINDS: AmPlanKind[] = ['care', 'qbr', 'renewal', 'expand'];

export const PLAN_SEED_TITLES: Record<AmPlanKind, string[]> = {
  qbr: ['Chuẩn bị số liệu QBR', 'Đặt lịch QBR', 'Gửi biên bản'],
  renewal: ['Rà soát phạm vi', 'Liên hệ stakeholder', 'Soạn đề xuất gia hạn'],
  care: ['Gọi health-check', 'Lập recovery nếu Critical'],
  expand: ['Xác nhận nhu cầu', 'Tạo bước next'],
};

const PLAN_COLS = `
  id::text AS id,
  agency_client_id::text AS agency_client_id,
  contract_id,
  kind,
  period_key,
  status,
  owner_staff_id,
  due_on
`;

function mapPlan(row: Record<string, unknown>): AmPlanRow {
  return {
    id: String(row.id),
    agency_client_id: String(row.agency_client_id ?? ''),
    contract_id: row.contract_id == null ? null : Number(row.contract_id),
    kind: String(row.kind) as AmPlanKind,
    period_key: String(row.period_key ?? ''),
    status: String(row.status ?? 'open'),
    owner_staff_id: Number(row.owner_staff_id ?? 0),
    due_on: row.due_on == null ? null : String(row.due_on).slice(0, 10),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === '23505';
}

@Injectable()
export class AmPlansRepository implements OnModuleDestroy, AmPlansStore {
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

  async insert(input: AmCreatePlanInput & { owner_staff_id: number }): Promise<AmPlanRow> {
    const result = await this.db.query(
      `INSERT INTO crm_am_plans (
         tenant_id, agency_client_id, contract_id, kind, period_key, status, owner_staff_id, due_on
       ) VALUES ($1, $2::uuid, $3, $4, $5, 'open', $6, $7)
       RETURNING ${PLAN_COLS}`,
      [
        AM_TENANT_ID,
        input.agency_client_id,
        input.contract_id ?? null,
        input.kind,
        input.period_key,
        input.owner_staff_id,
        input.due_on ?? null,
      ],
    );
    return mapPlan(result.rows[0]);
  }

  async deleteById(id: string): Promise<void> {
    await this.db.query(`DELETE FROM crm_am_plans WHERE tenant_id = $1 AND id = $2::uuid`, [
      AM_TENANT_ID,
      id,
    ]);
  }
}

@Injectable()
export class AmPlansService {
  constructor(
    private readonly repo: AmPlansRepository,
    private readonly tasks: AmTasksService,
    @Optional() private readonly dashboard?: AmDashboardService,
  ) {}

  async create(input: AmCreatePlanInput, staffId: number): Promise<AmPlanRow> {
    const kind = input.kind;
    if (kind === 'renewal' && !(Number(input.contract_id) > 0)) {
      amThrow(400, { error: 'contract_required' });
    }

    const agencyClientId = String(input.agency_client_id ?? '').trim();
    const periodKey = String(input.period_key ?? '').trim();
    if (!agencyClientId || !periodKey) {
      amThrow(400, { error: 'agency_client_id_and_period_key_required' });
    }
    if (!PLAN_KINDS.includes(kind)) {
      amThrow(400, { error: 'invalid_kind' });
    }
    if (!isUuid(agencyClientId)) {
      amThrow(400, { error: 'invalid_agency_client_id' });
    }

    const contractId =
      input.contract_id == null || input.contract_id === ('' as unknown as number)
        ? undefined
        : Number(input.contract_id);

    let plan: AmPlanRow;
    try {
      plan = await this.repo.insert({
        agency_client_id: agencyClientId,
        kind,
        period_key: periodKey,
        contract_id: contractId,
        due_on: input.due_on,
        owner_staff_id: staffId,
      });
    } catch (err) {
      if (isUniqueViolation(err)) amThrow(409, { error: 'duplicate_plan' });
      throw err;
    }

    try {
      for (const title of PLAN_SEED_TITLES[kind]) {
        await this.tasks.create(
          {
            agency_client_id: agencyClientId,
            title,
            kind: 'task',
            source: 'plan',
            source_ref: `${plan.id}:${title}`,
            due_at: input.due_on ? `${input.due_on}T00:00:00.000Z` : undefined,
          },
          staffId,
        );
      }
    } catch (err) {
      // Seed uses AmTasksService (separate pool). Compensate so retry is not 409-stuck.
      await this.repo.deleteById(plan.id);
      throw err;
    }

    this.dashboard?.dropCache();
    return plan;
  }
}
