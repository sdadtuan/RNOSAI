import { HttpException, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CP_TENANT_ID } from './cp-audit.repository';
import {
  canChargeIdempotent,
  CpLedgerRow,
  ledgerBalance,
} from './cp-credit.util';

export const CP_LEDGER_QUERY = 'CP_LEDGER_QUERY';

export interface CpLedgerQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export type CpLedgerKind = CpLedgerRow['kind'];

export type CpLedgerWrite = {
  kind: CpLedgerKind;
  amount: number;
  agencyClientId?: string | null;
  projectId?: string | null;
  jobId?: string | null;
  costCenter?: string | null;
  idempotencyKey: string;
};

export type CpLedgerGrantInput = {
  amount?: number;
  agency_client_id?: string;
  cost_center?: string | null;
};

@Injectable()
export class CpLedgerRepository implements CpLedgerQueryPort, OnModuleDestroy {
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
export class CpLedgerService {
  constructor(
    @Inject(CP_LEDGER_QUERY) private readonly db: CpLedgerQueryPort,
  ) {}

  async append(
    input: CpLedgerWrite,
    db: CpLedgerQueryPort = this.db,
  ): Promise<Record<string, unknown>> {
    const key = requiredText(input.idempotencyKey, 'idempotency_key_required');
    const amount = nonNegativeInteger(input.amount);
    const existing = await db.query(
      `SELECT * FROM crm_cp_credit_ledger
        WHERE tenant_id = $1 AND idempotency_key = $2
        LIMIT 1`,
      [CP_TENANT_ID, key],
    );
    if (!canChargeIdempotent(
      existing.rows[0] ? String(existing.rows[0].idempotency_key) : null,
      key,
    )) {
      return existing.rows[0];
    }

    const inserted = await db.query(
      `INSERT INTO crm_cp_credit_ledger (
         tenant_id, kind, amount, agency_client_id, project_id, job_id,
         cost_center, idempotency_key
       ) VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6::uuid, $7, $8)
       ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        CP_TENANT_ID,
        input.kind,
        amount,
        input.agencyClientId ?? null,
        input.projectId ?? null,
        input.jobId ?? null,
        nullableText(input.costCenter),
        key,
      ],
    );
    if (inserted.rows[0]) return inserted.rows[0];

    const raced = await db.query(
      `SELECT * FROM crm_cp_credit_ledger
        WHERE tenant_id = $1 AND idempotency_key = $2
        LIMIT 1`,
      [CP_TENANT_ID, key],
    );
    return raced.rows[0] ?? cpThrow(500, { error: 'ledger_insert_failed' });
  }

  reserve(
    input: Omit<CpLedgerWrite, 'kind'>,
    db: CpLedgerQueryPort = this.db,
  ) {
    return this.append({ ...input, kind: 'reserve' }, db);
  }

  async grant(
    input: CpLedgerGrantInput,
    idempotencyKey: string,
  ): Promise<Record<string, unknown>> {
    const key = requiredText(idempotencyKey, 'idempotency_key_required');
    const amount = nonNegativeInteger(input.amount);
    const agencyClientId = requiredUuid(
      input.agency_client_id,
      'invalid_agency_client_id',
    );
    const result = await this.db.query(
      `WITH inserted_ledger AS (
         INSERT INTO crm_cp_credit_ledger (
           tenant_id, kind, amount, agency_client_id, cost_center, idempotency_key
         ) VALUES ($1, 'grant', $2, $3::uuid, $4, $5)
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
         RETURNING *
       ), allocation AS (
         INSERT INTO crm_cp_credit_allocations (agency_client_id, allocated)
         SELECT agency_client_id, amount
           FROM inserted_ledger
         ON CONFLICT (agency_client_id) DO UPDATE
           SET allocated = crm_cp_credit_allocations.allocated + EXCLUDED.allocated
         RETURNING agency_client_id
       )
       SELECT inserted_ledger.*
         FROM inserted_ledger`,
      [
        CP_TENANT_ID,
        amount,
        agencyClientId,
        nullableText(input.cost_center),
        key,
      ],
    );
    if (result.rows[0]) return result.rows[0];

    const existing = await this.db.query(
      `SELECT * FROM crm_cp_credit_ledger
        WHERE tenant_id = $1 AND idempotency_key = $2
        LIMIT 1`,
      [CP_TENANT_ID, key],
    );
    return existing.rows[0] ?? cpThrow(500, { error: 'ledger_insert_failed' });
  }

  async sum(kind: CpLedgerKind, projectId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0)::int AS amount
         FROM crm_cp_credit_ledger
        WHERE tenant_id = $1 AND kind = $2 AND project_id = $3::uuid`,
      [CP_TENANT_ID, kind, requiredUuid(projectId, 'invalid_project_id')],
    );
    return Number(result.rows[0]?.amount ?? 0);
  }

  async balance(projectId: string) {
    const result = await this.db.query(
      `SELECT kind, amount
         FROM crm_cp_credit_ledger
        WHERE tenant_id = $1 AND project_id = $2::uuid
        ORDER BY created_at, id`,
      [CP_TENANT_ID, requiredUuid(projectId, 'invalid_project_id')],
    );
    return ledgerBalance(result.rows as CpLedgerRow[]);
  }
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

function nonNegativeInteger(value: unknown): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    cpThrow(400, { error: 'invalid_amount' });
  }
  return amount;
}

function requiredUuid(value: unknown, error: string): string {
  const id = String(value ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    cpThrow(400, { error });
  }
  return id;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
