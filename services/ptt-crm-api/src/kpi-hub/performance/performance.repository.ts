import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import { isMissingRelationError, withDbFallback } from '../kpi-hub.memory-store';

export type PmAssignmentRow = {
  id: string;
  tenant_id: string;
  definition_code: string;
  name: string;
  owner_name: string;
  scope_type: string;
  scope_id: string;
  scope_name: string;
  department: string;
  direction: string;
  target: number;
  target_min: number | null;
  target_stretch: number | null;
  assigned_target: number;
  quoted_target: number | null;
  source_id: string | null;
  instance_id: string | null;
  collection_method: string;
  quality: string;
  lifecycle: string;
  client_visible: boolean;
  disclaimer: string;
  assumption_open: boolean;
  period_label: string;
  cycle: string;
  row_version: number;
  created_at: string;
  updated_at: string;
};

export type PmCheckInRow = {
  id: string;
  tenant_id: string;
  assignment_id: string;
  forecast: string | null;
  blocker: string | null;
  evidence: string | null;
  note: string;
  review_state: string;
  review_comment: string | null;
  created_by: string;
  created_at: string;
};

export type PmActualRow = {
  id: string;
  tenant_id: string;
  assignment_id: string;
  value: number;
  quality: string;
  collection_method: string;
  supersedes: string | null;
  created_at: string;
};

export type PmSnapshotRow = {
  id: string;
  tenant_id: string;
  scorecard_id: string;
  period_label: string;
  hash: string;
  payload_json: unknown;
  created_at: string;
};

export type PmAuditRow = {
  id: string;
  tenant_id: string;
  actor: string;
  action: string;
  entity: string;
  payload_json: unknown;
  created_at: string;
};

type MemoryStore = {
  assignments: Map<string, PmAssignmentRow>;
  checkins: Map<string, PmCheckInRow>;
  actuals: Map<string, PmActualRow>;
  snapshots: Map<string, PmSnapshotRow>;
  audits: Map<string, PmAuditRow>;
  idempotency: Map<string, { tenant_id: string; response_json: unknown; created_at: string }>;
};

async function pmDbFallback<T>(dbFn: () => Promise<T>, memoryFn: () => T): Promise<T> {
  return withDbFallback(async () => {
    try {
      return await dbFn();
    } catch (err) {
      if (isMissingRelationError(err)) return null;
      throw err;
    }
  }, memoryFn);
}

@Injectable()
export class PerformanceRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private memory: MemoryStore = {
    assignments: new Map(),
    checkins: new Map(),
    actuals: new Map(),
    snapshots: new Map(),
    audits: new Map(),
    idempotency: new Map(),
  };

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

  async insertAssignment(
    input: Partial<PmAssignmentRow> &
      Pick<
        PmAssignmentRow,
        'name' | 'definition_code' | 'owner_name' | 'scope_type' | 'direction' | 'target' | 'assigned_target'
      >,
  ): Promise<PmAssignmentRow> {
    const row: PmAssignmentRow = {
      id: randomUUID(),
      tenant_id: 'PTT',
      scope_id: '',
      scope_name: '',
      department: '',
      target_min: null,
      target_stretch: null,
      quoted_target: null,
      source_id: null,
      instance_id: null,
      collection_method: 'manual',
      quality: 'pending',
      lifecycle: 'draft',
      client_visible: false,
      disclaimer: '',
      assumption_open: false,
      period_label: '',
      cycle: 'Tháng',
      row_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...input,
    };

    return pmDbFallback(
      async () => {
        throw new Error('postgres_not_implemented');
      },
      () => {
        this.memory.assignments.set(row.id, row);
        return row;
      },
    );
  }

  async getAssignment(id: string): Promise<PmAssignmentRow | null> {
    return pmDbFallback(
      async () => {
        throw new Error('postgres_not_implemented');
      },
      () => this.memory.assignments.get(id) ?? null,
    );
  }

  async listAssignments(): Promise<PmAssignmentRow[]> {
    return pmDbFallback(
      async () => {
        throw new Error('postgres_not_implemented');
      },
      () => [...this.memory.assignments.values()],
    );
  }

  async insertCheckIn(
    input: Pick<PmCheckInRow, 'assignment_id' | 'note'> &
      Partial<Pick<PmCheckInRow, 'forecast' | 'blocker' | 'evidence' | 'review_state' | 'created_by'>>,
  ): Promise<PmCheckInRow> {
    const row: PmCheckInRow = {
      id: randomUUID(),
      tenant_id: 'PTT',
      forecast: null,
      blocker: null,
      evidence: null,
      review_state: 'submitted',
      review_comment: null,
      created_by: '',
      created_at: new Date().toISOString(),
      ...input,
    };

    return pmDbFallback(
      async () => {
        throw new Error('postgres_not_implemented');
      },
      () => {
        this.memory.checkins.set(row.id, row);
        return row;
      },
    );
  }

  async insertActual(
    input: Pick<PmActualRow, 'assignment_id' | 'value' | 'quality' | 'collection_method'> &
      Partial<Pick<PmActualRow, 'supersedes'>>,
  ): Promise<PmActualRow> {
    const row: PmActualRow = {
      id: randomUUID(),
      tenant_id: 'PTT',
      supersedes: null,
      created_at: new Date().toISOString(),
      ...input,
    };

    return pmDbFallback(
      async () => {
        throw new Error('postgres_not_implemented');
      },
      () => {
        this.memory.actuals.set(row.id, row);
        return row;
      },
    );
  }

  async insertSnapshot(
    input: Pick<PmSnapshotRow, 'scorecard_id' | 'period_label' | 'hash' | 'payload_json'>,
  ): Promise<PmSnapshotRow> {
    const row: PmSnapshotRow = {
      id: randomUUID(),
      tenant_id: 'PTT',
      created_at: new Date().toISOString(),
      ...input,
    };

    return pmDbFallback(
      async () => {
        throw new Error('postgres_not_implemented');
      },
      () => {
        this.memory.snapshots.set(`${input.scorecard_id}:${input.period_label}`, row);
        return row;
      },
    );
  }

  async getSnapshot(scorecardId: string, periodLabel: string): Promise<PmSnapshotRow | null> {
    return pmDbFallback(
      async () => {
        throw new Error('postgres_not_implemented');
      },
      () => this.memory.snapshots.get(`${scorecardId}:${periodLabel}`) ?? null,
    );
  }

  async insertAudit(input: {
    actor: string;
    action: string;
    entity: string;
    payload_json?: unknown;
  }): Promise<PmAuditRow> {
    const row: PmAuditRow = {
      id: randomUUID(),
      tenant_id: 'PTT',
      payload_json: input.payload_json ?? {},
      created_at: new Date().toISOString(),
      ...input,
    };

    return pmDbFallback(
      async () => {
        throw new Error('postgres_not_implemented');
      },
      () => {
        this.memory.audits.set(row.id, row);
        return row;
      },
    );
  }

  async getIdempotency(key: string): Promise<unknown | null> {
    return pmDbFallback(
      async () => {
        throw new Error('postgres_not_implemented');
      },
      () => this.memory.idempotency.get(key)?.response_json ?? null,
    );
  }

  async putIdempotency(key: string, response: unknown): Promise<void> {
    return pmDbFallback(
      async () => {
        throw new Error('postgres_not_implemented');
      },
      () => {
        this.memory.idempotency.set(key, {
          tenant_id: 'PTT',
          response_json: response,
          created_at: new Date().toISOString(),
        });
      },
    );
  }
}
