import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { AmAuditRepository, AM_TENANT_ID } from './am-audit.repository';
import { AmDashboardService } from './am-dashboard.service';
import type { AmTaskKind, AmTaskStatus } from './am.types';

export type AmTaskPriority = 'low' | 'medium' | 'high';

export type AmTaskRow = {
  id: string;
  agency_client_id: string;
  title: string;
  kind: AmTaskKind;
  priority: AmTaskPriority;
  status: AmTaskStatus;
  assignee_staff_id: number | null;
  due_at: string | null;
  source: string;
  source_ref: string | null;
  dismissed_at: string | null;
};

export type AmCreateTaskInput = {
  agency_client_id: string;
  title: string;
  kind?: AmTaskKind;
  priority?: AmTaskPriority;
  due_at?: string;
  source?: string;
  source_ref?: string;
};

export type AmTasksStore = {
  findById(id: string): Promise<AmTaskRow | null>;
  accept(id: string, staffId: number): Promise<AmTaskRow | null>;
  findOpenBySourceRef(source: string, sourceRef: string): Promise<AmTaskRow | null>;
  insert(input: AmCreateTaskInput): Promise<AmTaskRow>;
  dismiss(source: string, sourceRef: string): Promise<number>;
};

const TASK_KINDS: AmTaskKind[] = [
  'task',
  'client_request',
  'issue',
  'escalation',
  'approval',
  'milestone',
];
const TASK_PRIORITIES: AmTaskPriority[] = ['low', 'medium', 'high'];

const TASK_COLS = `
  id::text AS id,
  agency_client_id::text AS agency_client_id,
  title,
  kind,
  priority,
  status,
  assignee_staff_id,
  due_at,
  source,
  source_ref,
  dismissed_at
`;

function mapTask(row: Record<string, unknown>): AmTaskRow {
  return {
    id: String(row.id),
    agency_client_id: String(row.agency_client_id ?? ''),
    title: String(row.title ?? ''),
    kind: (TASK_KINDS.includes(String(row.kind) as AmTaskKind) ? row.kind : 'task') as AmTaskKind,
    priority: (TASK_PRIORITIES.includes(String(row.priority) as AmTaskPriority)
      ? row.priority
      : 'medium') as AmTaskPriority,
    status: String(row.status ?? 'new') as AmTaskStatus,
    assignee_staff_id: row.assignee_staff_id == null ? null : Number(row.assignee_staff_id),
    due_at: row.due_at == null ? null : new Date(String(row.due_at)).toISOString(),
    source: String(row.source ?? 'manual'),
    source_ref: row.source_ref == null || row.source_ref === '' ? null : String(row.source_ref),
    dismissed_at: row.dismissed_at == null ? null : new Date(String(row.dismissed_at)).toISOString(),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === '23505';
}

@Injectable()
export class AmTasksRepository implements OnModuleDestroy, AmTasksStore {
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

  async findById(id: string): Promise<AmTaskRow | null> {
    const result = await this.db.query(
      `SELECT ${TASK_COLS} FROM crm_am_tasks WHERE tenant_id = $1 AND id = $2::uuid LIMIT 1`,
      [AM_TENANT_ID, id],
    );
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async accept(id: string, staffId: number): Promise<AmTaskRow | null> {
    const result = await this.db.query(
      `UPDATE crm_am_tasks
          SET assignee_staff_id = $2,
              status = 'in_progress',
              updated_at = now()
        WHERE tenant_id = $1 AND id = $3::uuid
        RETURNING ${TASK_COLS}`,
      [AM_TENANT_ID, staffId, id],
    );
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async findOpenBySourceRef(source: string, sourceRef: string): Promise<AmTaskRow | null> {
    const result = await this.db.query(
      `SELECT ${TASK_COLS}
         FROM crm_am_tasks
        WHERE tenant_id = $1
          AND source = $2
          AND source_ref = $3
          AND dismissed_at IS NULL
          AND status NOT IN ('cancelled', 'closed')
        LIMIT 1`,
      [AM_TENANT_ID, source, sourceRef],
    );
    const row = result.rows[0];
    return row ? mapTask(row) : null;
  }

  async insert(input: AmCreateTaskInput): Promise<AmTaskRow> {
    const result = await this.db.query(
      `INSERT INTO crm_am_tasks (
         tenant_id, agency_client_id, title, kind, priority, status,
         source, source_ref, due_at
       ) VALUES ($1, $2::uuid, $3, $4, $5, 'new', $6, $7, $8)
       RETURNING ${TASK_COLS}`,
      [
        AM_TENANT_ID,
        input.agency_client_id,
        input.title,
        input.kind ?? 'task',
        input.priority ?? 'medium',
        input.source ?? 'manual',
        input.source_ref ?? null,
        input.due_at ?? null,
      ],
    );
    return mapTask(result.rows[0]);
  }

  async dismiss(source: string, sourceRef: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE crm_am_tasks
          SET dismissed_at = now(),
              updated_at = now()
        WHERE tenant_id = $1
          AND source = $2
          AND source_ref = $3
          AND dismissed_at IS NULL`,
      [AM_TENANT_ID, source, sourceRef],
    );
    return result.rowCount ?? 0;
  }
}

@Injectable()
export class AmTasksService {
  constructor(
    private readonly repo: AmTasksRepository,
    private readonly audit: AmAuditRepository,
    @Optional() private readonly dashboard?: AmDashboardService,
  ) {}

  async accept(id: string, staffId: number): Promise<AmTaskRow> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException({ error: 'task_not_found' });
    const out = (await this.repo.accept(id, staffId)) ?? {
      ...existing,
      assignee_staff_id: staffId,
      status: 'in_progress' as const,
    };
    await this.audit.insert({
      actor_staff_id: staffId || null,
      action: 'task.accept',
      entity_type: 'task',
      entity_id: out.id,
      payload_json: { assignee_staff_id: staffId, status: out.status },
    });
    this.dashboard?.dropCache();
    return out;
  }

  async create(input: AmCreateTaskInput, _staffId: number): Promise<AmTaskRow> {
    const agencyClientId = String(input.agency_client_id ?? '').trim();
    const title = String(input.title ?? '').trim();
    if (!agencyClientId || !title) {
      throw new BadRequestException({ error: 'agency_client_id_and_title_required' });
    }
    const source = String(input.source ?? 'manual').trim() || 'manual';
    const sourceRef = input.source_ref != null ? String(input.source_ref).trim() : '';
    const kind = TASK_KINDS.includes(input.kind as AmTaskKind) ? (input.kind as AmTaskKind) : 'task';
    const priority = TASK_PRIORITIES.includes(input.priority as AmTaskPriority)
      ? (input.priority as AmTaskPriority)
      : 'medium';
    const payload: AmCreateTaskInput = {
      agency_client_id: agencyClientId,
      title,
      kind,
      priority,
      due_at: input.due_at,
      source,
      source_ref: sourceRef || undefined,
    };
    if (payload.source_ref) {
      const dup = await this.repo.findOpenBySourceRef(source, payload.source_ref);
      if (dup) throw new ConflictException({ error: 'duplicate_source_ref' });
    }
    try {
      const out = await this.repo.insert(payload);
      this.dashboard?.dropCache();
      return out;
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException({ error: 'duplicate_source_ref' });
      throw err;
    }
  }

  async dismiss(body: { source: string; source_ref: string }, staffId: number): Promise<{ dismissed: number }> {
    const source = String(body.source ?? '').trim();
    const sourceRef = String(body.source_ref ?? '').trim();
    if (!source || !sourceRef) {
      throw new BadRequestException({ error: 'source_and_source_ref_required' });
    }
    const dismissed = await this.repo.dismiss(source, sourceRef);
    await this.audit.insert({
      actor_staff_id: staffId || null,
      action: 'task.dismiss',
      entity_type: 'task',
      payload_json: { source, source_ref: sourceRef, dismissed },
    });
    this.dashboard?.dropCache();
    return { dismissed };
  }
}
