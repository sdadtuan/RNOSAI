import { HttpException, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common/interfaces';
import { Observable } from 'rxjs';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { CP_TENANT_ID } from './cp-audit.repository';
import { hardCapBlocks } from './cp-credit.util';
import { CpLedgerService } from './cp-ledger.service';
import {
  CP_RENDER_EVENT_POLL_MS,
  isTerminalRenderState,
  mapRenderJobEvent,
} from './cp-render-events.util';
import { CpRenderWorker, CP_STUB_PRICING_VERSION } from './cp-render.worker';
import { CpBrandService } from './cp-brand.service';
import { renderBlockReasons } from './cp-render-block.util';
import { cpScopeSql, CpScope } from './cp-scope.util';

export const CP_RENDERS_QUERY = 'CP_RENDERS_QUERY';
const DEFAULT_SCOPE: CpRenderScope = { scope: 'all', staffId: 0, teamIds: [] };

export interface CpRendersQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
  transaction<T>(work: (tx: CpRendersTransaction) => Promise<T>): Promise<T>;
}

export interface CpRendersTransaction {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export type CpRenderScope = {
  scope: CpScope;
  staffId: number;
  teamIds?: number[];
};

@Injectable()
export class CpRendersRepository implements CpRendersQueryPort, OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  query(sql: string, params?: unknown[]) {
    return this.db.query(sql, params);
  }

  async transaction<T>(work: (tx: CpRendersTransaction) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    const tx: CpRendersTransaction = {
      query: (sql, params) => client.query(sql, params),
    };
    try {
      await client.query('BEGIN');
      const result = await work(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }
}

@Injectable()
export class CpRendersService {
  constructor(
    @Inject(CP_RENDERS_QUERY) private readonly db: CpRendersQueryPort,
    private readonly ledger: CpLedgerService,
    private readonly worker: CpRenderWorker,
    private readonly brand?: CpBrandService,
  ) {}

  submit(
    draftId: string,
    idempotencyKey: string,
    scope: CpRenderScope = DEFAULT_SCOPE,
    opts?: { batchItemId?: string | null },
  ) {
    return this.submitInternal(draftId, idempotencyKey, null, 1, scope, opts?.batchItemId ?? null);
  }

  async list(scope: CpRenderScope = DEFAULT_SCOPE) {
    const allowed = projectScope(scope, 2);
    const result = await this.db.query(
      `SELECT j.*
         FROM crm_cp_render_jobs j
         JOIN crm_cp_video_drafts d ON d.id = j.draft_id
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE p.tenant_id = $1 AND ${allowed.sql}
        ORDER BY j.created_at DESC, j.id DESC
        LIMIT 50`,
      [CP_TENANT_ID, ...allowed.params],
    );
    return { items: result.rows };
  }

  async get(id: string, scope: CpRenderScope = DEFAULT_SCOPE) {
    const jobId = requiredUuid(id, 'invalid_render_id');
    const allowed = projectScope(scope, 3);
    const result = await this.db.query(
      `SELECT j.*
         FROM crm_cp_render_jobs j
         JOIN crm_cp_video_drafts d ON d.id = j.draft_id
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE p.tenant_id = $1 AND j.id = $2::uuid AND ${allowed.sql}
        LIMIT 1`,
      [CP_TENANT_ID, jobId, ...allowed.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  streamEvents(
    id: string,
    scope: CpRenderScope = DEFAULT_SCOPE,
    intervalMs = CP_RENDER_EVENT_POLL_MS,
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      let lastFingerprint: string | null = null;
      let closed = false;
      let handle: ReturnType<typeof setInterval> | undefined;
      const stop = () => {
        closed = true;
        if (handle) clearInterval(handle);
      };
      const tick = async () => {
        if (closed) return;
        try {
          const job = await this.get(id, scope);
          const fingerprint = `${job.state}:${job.stage}:${job.progress}`;
          if (fingerprint !== lastFingerprint) {
            lastFingerprint = fingerprint;
            subscriber.next({ data: mapRenderJobEvent(job) });
          }
          if (isTerminalRenderState(String(job.state ?? ''))) {
            stop();
            subscriber.complete();
          }
        } catch (error) {
          stop();
          subscriber.error(error);
        }
      };
      void tick();
      handle = setInterval(() => void tick(), intervalMs);
      handle.unref?.();
      return stop;
    });
  }

  async retryJob(
    id: string,
    scope: CpRenderScope = DEFAULT_SCOPE,
  ): Promise<Record<string, unknown>> {
    const parent = await this.loadJob(id, scope);
    if (!['failed', 'cancelled', 'expired'].includes(String(parent.state))) {
      cpThrow(409, { error: 'render_not_retryable' });
    }
    const attempt = Number(parent.attempt ?? 1) + 1;
    const key = `${String(parent.idempotency_key)}:r${attempt}`;
    return this.submitInternal(
      String(parent.draft_id),
      key,
      String(parent.id),
      attempt,
      scope,
      nullableText(parent.batch_item_id),
    );
  }

  async cancelJob(
    id: string,
    scope: CpRenderScope = DEFAULT_SCOPE,
  ): Promise<Record<string, unknown>> {
    const job = await this.loadJob(id, scope);
    if (['completed', 'cancelled', 'expired'].includes(String(job.state))) {
      cpThrow(409, { error: 'render_not_cancellable' });
    }
    const result = await this.db.query(
      `UPDATE crm_cp_render_jobs
          SET state = 'cancelled', stage = 'cancelled'
        WHERE id = $1::uuid
        RETURNING *`,
      [job.id],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  private async submitInternal(
    draftId: string,
    idempotencyKey: string,
    parentJobId: string | null,
    attempt: number,
    scope: CpRenderScope,
    batchItemId: string | null = null,
  ): Promise<Record<string, unknown>> {
    const key = requiredText(idempotencyKey, 'idempotency_key_required');
    const draft = await this.loadDraft(draftId, scope);
    return this.db.transaction(async (tx) => {
      const existing = await this.findByKey(String(draft.id), key, tx);
      if (existing) return renderResponse(existing);

      const config = objectValue(draft.config_json);
      const estimate = nullableNonNegativeInteger(
        config.estimated_credits,
        'invalid_estimate',
      );
      const creditHard = config.credit_hard_cap === true;
      const creditBlocked = estimate === null
        ? false
        : hardCapBlocks({
          allocated: Number(draft.credit_allocated ?? 0),
          used: Number(draft.credit_used ?? 0),
          reserve: estimate,
          hard: creditHard,
        });
      const kitVersion = objectValue(draft.kit_version);
      const kitVersionId = nullableText(draft.brand_kit_version_id)
        ?? nullableText(kitVersion.id);
      const brandRule = kitVersionId && this.brand
        ? await this.brand.evaluateRules(kitVersionId, {
          output_type: 'video',
          channel: nullableText(config.channel),
          ratio: nullableText(config.ratio),
          has_claim: config.has_claim === true,
        })
        : { enforcement: null };
      const reasons = renderBlockReasons({
        aiEnabled: process.env.CP_AI_ENABLED === 'true',
        hasRenderCap: true,
        assetState: nullableText(draft.asset_state),
        rightsExpired: draft.rights_expired === true,
        creditBlocked,
        moderationBlocked: draft.moderation_blocked === true,
        qcStatus: nullableText(draft.qc_status),
        brandRuleEnforcement: brandRule.enforcement,
      }).filter((reason) => reason !== 'ai_disabled');
      if (reasons.length) cpThrow(409, { error: 'render_blocked', reasons });

      const snapshot = {
        draft: snapshotDraft(draft),
        kit_version: draft.kit_version ?? null,
        asset_versions: arrayValue(draft.asset_versions),
        pricing_version: CP_STUB_PRICING_VERSION,
      };
      const correlationId = `${key}:${Date.now()}`;
      const inserted = await tx.query(
        `INSERT INTO crm_cp_render_jobs (
           draft_id, parent_job_id, batch_item_id, state, stage, progress, provider,
           idempotency_key, correlation_id, stage_log_json, attempt
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, 'queued', 'queued', 0, 'stub',
           $4, $5, $6::jsonb, $7
         )
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING *`,
        [
          draft.id,
          parentJobId,
          batchItemId,
          key,
          correlationId,
          JSON.stringify([{ stage: 'queued', estimate, at: new Date().toISOString() }]),
          attempt,
        ],
      );
      const job = inserted.rows[0];
      if (!job) {
        const raced = await this.findByKey(String(draft.id), key, tx);
        if (raced) return renderResponse(raced);
        cpThrow(409, { error: 'idempotency_key_conflict' });
      }

      if (estimate !== null) {
        await this.ledger.reserve({
          amount: estimate,
          agencyClientId: nullableText(draft.agency_client_id),
          projectId: nullableText(draft.project_id),
          jobId: String(job.id),
          costCenter: nullableText(draft.cost_center),
          idempotencyKey: `render:${key}:reserve`,
        }, tx);
      }
      await this.worker.process(job, {
        ...snapshot,
        render_job_id: job.id,
      }, tx);
      const processed = await this.findByKey(String(draft.id), key, tx);
      return renderResponse(processed ?? job, estimate);
    });
  }

  private async findByKey(
    draftId: string,
    key: string,
    db: CpRendersTransaction = this.db,
  ) {
    const result = await db.query(
      `SELECT j.*,
              (j.stage_log_json->0->>'estimate')::int AS estimate
         FROM crm_cp_render_jobs j
         JOIN crm_cp_video_drafts d ON d.id = j.draft_id
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE j.idempotency_key = $1
          AND j.draft_id = $2::uuid
          AND p.tenant_id = $3
        LIMIT 1`,
      [key, draftId, CP_TENANT_ID],
    );
    return result.rows[0] ?? null;
  }

  private async loadJob(id: string, scope: CpRenderScope) {
    const allowed = projectScope(scope, 3);
    const result = await this.db.query(
      `SELECT j.*
         FROM crm_cp_render_jobs j
         JOIN crm_cp_video_drafts d ON d.id = j.draft_id
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE j.id = $1::uuid AND p.tenant_id = $2 AND ${allowed.sql}
        LIMIT 1`,
      [
        requiredUuid(id, 'invalid_render_id'),
        CP_TENANT_ID,
        ...allowed.params,
      ],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  private async loadDraft(id: string, scope: CpRenderScope) {
    const allowed = projectScope(scope, 3);
    const result = await this.db.query(
      `SELECT d.*, p.cost_center,
              CASE
                WHEN COUNT(u.asset_version_id) = 0 THEN NULL
                WHEN BOOL_AND(a.state = 'ready') THEN 'ready'
                ELSE MIN(a.state)
              END AS asset_state,
              COALESCE(BOOL_OR(r.expiry_on < CURRENT_DATE), FALSE) AS rights_expired,
              COALESCE((d.config_json->>'moderation_blocked')::boolean, FALSE)
                AS moderation_blocked,
              d.config_json->>'qc_status' AS qc_status,
              COALESCE((
                SELECT SUM(CASE
                  WHEN l.kind IN ('grant','adjustment') THEN l.amount
                  WHEN l.kind = 'expiry' THEN -l.amount
                  ELSE 0 END)
                  FROM crm_cp_credit_ledger l
                 WHERE l.tenant_id = $2 AND l.project_id = d.project_id
              ), 0) AS credit_allocated,
              COALESCE((
                SELECT SUM(CASE
                  WHEN l.kind IN ('reserve','charge') THEN l.amount
                  WHEN l.kind IN ('release','refund') THEN -l.amount
                  ELSE 0 END)
                  FROM crm_cp_credit_ledger l
                 WHERE l.tenant_id = $2 AND l.project_id = d.project_id
              ), 0) AS credit_used,
              (
                SELECT to_jsonb(kv)
                  FROM crm_cp_brand_kit_versions kv
                 WHERE kv.id = d.brand_kit_version_id
              ) AS kit_version,
              COALESCE(
                jsonb_agg(DISTINCT to_jsonb(av))
                  FILTER (WHERE av.id IS NOT NULL),
                '[]'::jsonb
              ) AS asset_versions
         FROM crm_cp_video_drafts d
         JOIN crm_cp_projects p ON p.id = d.project_id AND p.tenant_id = $2
         LEFT JOIN crm_cp_asset_usages u
           ON u.object_type = 'video_draft' AND u.object_id = d.id
         LEFT JOIN crm_cp_asset_versions av ON av.id = u.asset_version_id
         LEFT JOIN crm_cp_assets a ON a.id = av.asset_id
         LEFT JOIN crm_cp_asset_rights r ON r.asset_id = a.id
        WHERE d.id = $1::uuid AND ${allowed.sql}
        GROUP BY d.id, p.cost_center
        LIMIT 1`,
      [
        requiredUuid(id, 'invalid_video_id'),
        CP_TENANT_ID,
        ...allowed.params,
      ],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }
}

function renderResponse(
  job: Record<string, unknown>,
  estimate?: number | null,
) {
  return {
    ...job,
    job_id: job.id,
    estimate: estimate === undefined
      ? nullableNumber(job.estimate)
      : estimate,
  };
}

function snapshotDraft(draft: Record<string, unknown>) {
  const {
    asset_state: _assetState,
    rights_expired: _rightsExpired,
    moderation_blocked: _moderationBlocked,
    qc_status: _qcStatus,
    credit_allocated: _creditAllocated,
    credit_used: _creditUsed,
    kit_version: _kitVersion,
    asset_versions: _assetVersions,
    ...snapshot
  } = draft;
  return snapshot;
}

function projectScope(scope: CpRenderScope, startAt: number) {
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
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

function nullableNonNegativeInteger(
  value: unknown,
  error: string,
): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) cpThrow(400, { error });
  return number;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
