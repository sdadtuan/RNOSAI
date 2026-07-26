import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  AiRecommendationRecord,
  RecommendationStatus,
} from './recommendation.types';

function mapRow(row: Record<string, unknown>): AiRecommendationRecord {
  return {
    id: String(row.id ?? ''),
    client_id: (row.client_id as string | null) ?? null,
    entity_type: String(row.entity_type ?? ''),
    entity_id: String(row.entity_id ?? ''),
    recommendation_type: String(row.recommendation_type ?? ''),
    recommendation_text: String(row.recommendation_text ?? ''),
    action_json: (row.action_json as Record<string, unknown>) ?? {},
    confidence: row.confidence != null ? Number(row.confidence) : null,
    status: String(row.status ?? 'pending') as RecommendationStatus,
    dismissed_reason: (row.dismissed_reason as string | null) ?? null,
    accepted_by: (row.accepted_by as string | null) ?? null,
    accepted_at: row.accepted_at != null ? String(row.accepted_at) : null,
    agent_run_id: (row.agent_run_id as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

@Injectable()
export class AiRecommendationsRepository implements OnModuleDestroy {
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
         WHERE table_schema = 'public' AND table_name = 'ai_recommendations'
         LIMIT 1`,
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch {
      return false;
    }
  }

  async insert(args: {
    entityType: string;
    entityId: string;
    recommendationType: string;
    text: string;
    actionJson: Record<string, unknown>;
    confidence: number | null;
    agentRunId: string | null;
    clientId?: string | null;
  }): Promise<AiRecommendationRecord> {
    const result = await this.db.query(
      `INSERT INTO ai_recommendations (
         client_id, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, agent_run_id
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6::jsonb, $7, 'pending', $8::uuid
       )
       RETURNING
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text`,
      [
        args.clientId ?? null,
        args.entityType,
        args.entityId,
        args.recommendationType,
        args.text,
        JSON.stringify(args.actionJson ?? {}),
        args.confidence,
        args.agentRunId,
      ],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async findById(id: string): Promise<AiRecommendationRecord | null> {
    const result = await this.db.query(
      `SELECT
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text
       FROM ai_recommendations
       WHERE id = $1::uuid
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }

  async listByEntity(
    entityType: string,
    entityId: string,
    status?: RecommendationStatus,
    limit = 10,
  ): Promise<AiRecommendationRecord[]> {
    const capped = Math.min(Math.max(limit, 1), 50);
    const select = `SELECT
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text
       FROM ai_recommendations
       WHERE entity_type = $1 AND entity_id = $2`;
    if (status) {
      const result = await this.db.query(
        `${select} AND status = $3 ORDER BY created_at DESC LIMIT $4`,
        [entityType, entityId, status, capped],
      );
      return result.rows.map((row) => mapRow(row as Record<string, unknown>));
    }
    const result = await this.db.query(`${select} ORDER BY created_at DESC LIMIT $3`, [
      entityType,
      entityId,
      capped,
    ]);
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }

  async updateStatus(args: {
    id: string;
    status: RecommendationStatus;
    recommendationText?: string;
    acceptedBy?: string | null;
    dismissedReason?: string | null;
  }): Promise<AiRecommendationRecord | null> {
    const result = await this.db.query(
      `UPDATE ai_recommendations
       SET status = $2::varchar,
           recommendation_text = COALESCE($3, recommendation_text),
           accepted_by = CASE WHEN $2::varchar = 'accepted' THEN $4 ELSE accepted_by END,
           accepted_at = CASE WHEN $2::varchar = 'accepted' THEN NOW() ELSE accepted_at END,
           dismissed_reason = CASE WHEN $2::varchar = 'dismissed' THEN $5 ELSE dismissed_reason END,
           updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING
         id::text, client_id::text, entity_type, entity_id, recommendation_type,
         recommendation_text, action_json, confidence, status, dismissed_reason,
         accepted_by, accepted_at::text, agent_run_id::text,
         created_at::text, updated_at::text`,
      [
        args.id,
        args.status,
        args.recommendationText ?? null,
        args.acceptedBy ?? null,
        args.dismissedReason ?? null,
      ],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  }
}
