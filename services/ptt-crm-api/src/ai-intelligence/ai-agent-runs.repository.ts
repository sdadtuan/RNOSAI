import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  AiAgentRunInsert,
  AiAgentRunListQuery,
  AiAgentRunListResult,
  AiAgentRunRecord,
  AiAgentRunRow,
  AiAgentRunStatus,
} from './ai-intelligence.types';

function mapRunRow(row: Record<string, unknown>): AiAgentRunRecord {
  return {
    id: String(row.id ?? ''),
    client_id: (row.client_id as string | null) ?? null,
    agent_name: String(row.agent_name ?? ''),
    use_case: (row.use_case as string | null) ?? null,
    model_name: (row.model_name as string | null) ?? null,
    prompt_hash: (row.prompt_hash as string | null) ?? null,
    input_json: (row.input_json as Record<string, unknown>) ?? {},
    output_json: (row.output_json as Record<string, unknown>) ?? {},
    status: row.status as AiAgentRunStatus,
    latency_ms: row.latency_ms != null ? Number(row.latency_ms) : null,
    token_usage: (row.token_usage as AiAgentRunRecord['token_usage']) ?? {},
    error_message: (row.error_message as string | null) ?? null,
    correlation_id: (row.correlation_id as string | null) ?? null,
    actor_id: (row.actor_id as string | null) ?? null,
    started_at: String(row.started_at ?? ''),
    ended_at: row.ended_at != null ? String(row.ended_at) : null,
    created_at: String(row.created_at ?? ''),
  };
}

@Injectable()
export class AiAgentRunsRepository implements OnModuleDestroy {
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

  async tableReady(): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'ai_agent_runs'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async migrationVersion(): Promise<string | null> {
    try {
      const result = await this.db.query(
        `SELECT version FROM schema_migrations
         WHERE version = '2026-07-26-revenue-os-ai'
         LIMIT 1`,
      );
      return (result.rows[0]?.version as string | undefined) ?? null;
    } catch {
      return null;
    }
  }

  async insertRun(row: AiAgentRunInsert): Promise<AiAgentRunRow> {
    const outputJson = { ...(row.outputJson ?? {}) };
    if (row.errorCode) {
      outputJson.error_code = row.errorCode;
    }

    const result = await this.db.query(
      `INSERT INTO ai_agent_runs (
         client_id, agent_name, use_case, model_name, prompt_hash,
         input_json, output_json, status, latency_ms, token_usage,
         correlation_id, actor_id, error_message, ended_at
       ) VALUES (
         $1::uuid, $2, $3, $4, $5,
         $6::jsonb, $7::jsonb, $8, $9, $10::jsonb,
         $11, $12, $13,
         CASE WHEN $8::varchar IN ('succeeded', 'failed', 'cancelled') THEN NOW() ELSE NULL END
       )
       RETURNING id::text AS id`,
      [
        row.clientId ?? null,
        row.agentName,
        row.useCase,
        row.modelName ?? null,
        row.promptHash ?? null,
        JSON.stringify(row.inputJson ?? {}),
        JSON.stringify(outputJson),
        row.status,
        row.latencyMs ?? null,
        JSON.stringify(row.tokenUsage ?? {}),
        row.correlationId ?? null,
        row.actorId ?? null,
        row.errorMessage ?? null,
      ],
    );
    return { id: String(result.rows[0]?.id ?? '') };
  }

  async getById(id: string): Promise<AiAgentRunRecord | null> {
    const result = await this.db.query(
      `SELECT
         id::text, client_id::text, agent_name, use_case, model_name, prompt_hash,
         input_json, output_json, status, latency_ms, token_usage,
         error_message, correlation_id, actor_id,
         started_at::text, ended_at::text, created_at::text
       FROM ai_agent_runs
       WHERE id = $1::uuid
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapRunRow(row) : null;
  }

  async listRuns(query: AiAgentRunListQuery): Promise<AiAgentRunListResult> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let idx = 1;

    if (query.from) {
      conditions.push(`started_at >= $${idx++}::timestamptz`);
      params.push(query.from);
    }
    if (query.to) {
      conditions.push(`started_at <= $${idx++}::timestamptz`);
      params.push(query.to);
    }
    if (query.useCase) {
      conditions.push(`use_case = $${idx++}`);
      params.push(query.useCase);
    }
    if (query.actorId) {
      conditions.push(`actor_id = $${idx++}`);
      params.push(query.actorId);
    }
    if (query.status) {
      conditions.push(`status = $${idx++}`);
      params.push(query.status);
    }
    if (query.entityType) {
      conditions.push(`input_json->>'entity_type' = $${idx++}`);
      params.push(query.entityType);
    }
    if (query.entityId) {
      conditions.push(`input_json->>'entity_id' = $${idx++}`);
      params.push(query.entityId);
    }

    const where = conditions.join(' AND ');
    const countResult = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM ai_agent_runs WHERE ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    const listParams = [...params, limit, offset];
    const result = await this.db.query(
      `SELECT
         id::text, client_id::text, agent_name, use_case, model_name, prompt_hash,
         input_json, output_json, status, latency_ms, token_usage,
         error_message, correlation_id, actor_id,
         started_at::text, ended_at::text, created_at::text
       FROM ai_agent_runs
       WHERE ${where}
       ORDER BY started_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      listParams,
    );

    return {
      rows: result.rows.map(mapRunRow),
      total,
    };
  }

  /** RNOS-05 unit/integration probe — delete after insert. */
  async smokeInsertAndDelete(): Promise<boolean> {
    const inserted = await this.insertRun({
      agentName: 'rnos05_probe',
      useCase: 'audit_smoke',
      status: 'succeeded',
      inputJson: { probe: true },
      outputJson: { ok: true },
      latencyMs: 1,
    });
    if (!inserted.id) return false;
    await this.db.query('DELETE FROM ai_agent_runs WHERE id = $1::uuid', [inserted.id]);
    return true;
  }
}
