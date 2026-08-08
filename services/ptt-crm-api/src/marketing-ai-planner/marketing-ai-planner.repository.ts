import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { emptyDraft } from './marketing-ai-brief.util';
import type {
  MktAiBrief,
  MktAiDocumentRow,
  MktAiDocumentStatus,
  MktAiDraft,
  MktAiJobRow,
  MktAiJobStatus,
  MktAiJobType,
  MktAiRagChunkHit,
} from './marketing-ai-planner.types';
import type { MktAiTextChunk } from './marketing-ai-rag.util';

type MemoryStore = {
  briefs: Map<number, { brief_json: MktAiBrief; prefill_sources_json: string[]; updated_by: string }>;
  drafts: Map<number, MktAiDraft & { updated_by: string }>;
  jobs: MktAiJobRow[];
  campaigns: Map<number, unknown[]>;
  content: Map<number, unknown[]>;
  exports: Array<Record<string, unknown>>;
  documents: MktAiDocumentRow[];
  chunks: Array<{
    id: number;
    document_id: number;
    chunk_index: number;
    page_no: number | null;
    title: string;
    body: string;
    token_count: number | null;
  }>;
  nextJobId: number;
  nextDocumentId: number;
  nextChunkId: number;
};

@Injectable()
export class MarketingAiPlannerRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;
  private readonly memory: MemoryStore = {
    briefs: new Map(),
    drafts: new Map(),
    jobs: [],
    campaigns: new Map(),
    content: new Map(),
    exports: [],
    documents: [],
    chunks: [],
    nextJobId: 1,
    nextDocumentId: 1,
    nextChunkId: 1,
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

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM mkt_ai_briefs LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  async getBrief(lifecycleId: number): Promise<{
    brief_json: MktAiBrief;
    prefill_sources_json: string[];
    updated_by: string;
  } | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT brief_json, prefill_sources_json, updated_by FROM mkt_ai_briefs WHERE lifecycle_id = $1`,
        [lifecycleId],
      );
      if (!res.rows[0]) return null;
      return {
        brief_json: res.rows[0].brief_json as MktAiBrief,
        prefill_sources_json: (res.rows[0].prefill_sources_json as string[]) ?? [],
        updated_by: String(res.rows[0].updated_by ?? ''),
      };
    }
    return this.memory.briefs.get(lifecycleId) ?? null;
  }

  async upsertBrief(
    lifecycleId: number,
    brief: MktAiBrief,
    prefillSources: string[],
    actorEmail: string,
  ): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(
        `INSERT INTO mkt_ai_briefs (lifecycle_id, brief_json, prefill_sources_json, validation_json, created_by, updated_by)
         VALUES ($1, $2::jsonb, $3::jsonb, '{}'::jsonb, $4, $4)
         ON CONFLICT (lifecycle_id) DO UPDATE SET
           brief_json = EXCLUDED.brief_json,
           prefill_sources_json = EXCLUDED.prefill_sources_json,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [lifecycleId, JSON.stringify(brief), JSON.stringify(prefillSources), actorEmail],
      );
      return;
    }
    this.memory.briefs.set(lifecycleId, {
      brief_json: brief,
      prefill_sources_json: prefillSources,
      updated_by: actorEmail,
    });
  }

  async getDraft(lifecycleId: number): Promise<MktAiDraft | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT strategy_framework_json, target_market_prof_json, swot_json, campaigns_json,
                content_json, quality_score_json
         FROM mkt_ai_drafts WHERE lifecycle_id = $1`,
        [lifecycleId],
      );
      if (!res.rows[0]) return null;
      const r = res.rows[0];
      return {
        strategy_framework: (r.strategy_framework_json as Record<string, string>) ?? {},
        target_market_prof: (r.target_market_prof_json as Record<string, string>) ?? {},
        swot_json: (r.swot_json as Record<string, unknown>) ?? {},
        campaigns_json: (r.campaigns_json as MktAiDraft['campaigns_json']) ?? [],
        content_json: (r.content_json as Record<string, unknown>) ?? {},
        quality_score_json: (r.quality_score_json as Record<string, unknown>) ?? {},
      };
    }
    const row = this.memory.drafts.get(lifecycleId);
    if (!row) return null;
    const { updated_by: _u, ...draft } = row;
    return draft;
  }

  async upsertDraft(lifecycleId: number, draft: MktAiDraft, actorEmail: string): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(
        `INSERT INTO mkt_ai_drafts (
           lifecycle_id, strategy_framework_json, target_market_prof_json, swot_json,
           campaigns_json, content_json, quality_score_json, updated_by
         ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8)
         ON CONFLICT (lifecycle_id) DO UPDATE SET
           strategy_framework_json = EXCLUDED.strategy_framework_json,
           target_market_prof_json = EXCLUDED.target_market_prof_json,
           swot_json = EXCLUDED.swot_json,
           campaigns_json = EXCLUDED.campaigns_json,
           content_json = EXCLUDED.content_json,
           quality_score_json = EXCLUDED.quality_score_json,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [
          lifecycleId,
          JSON.stringify(draft.strategy_framework ?? {}),
          JSON.stringify(draft.target_market_prof ?? {}),
          JSON.stringify(draft.swot_json ?? {}),
          JSON.stringify(draft.campaigns_json ?? []),
          JSON.stringify(draft.content_json ?? {}),
          JSON.stringify(draft.quality_score_json ?? {}),
          actorEmail,
        ],
      );
      return;
    }
    this.memory.drafts.set(lifecycleId, { ...draft, updated_by: actorEmail });
  }

  async ensureDraft(lifecycleId: number, actorEmail: string): Promise<MktAiDraft> {
    const existing = await this.getDraft(lifecycleId);
    if (existing) return existing;
    const draft = emptyDraft() as MktAiDraft;
    await this.upsertDraft(lifecycleId, draft, actorEmail);
    return draft;
  }

  async listJobs(lifecycleId: number, limit = 20): Promise<MktAiJobRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, job_type, status, prompt_version, model_name,
                input_json, output_json, error_message, latency_ms, actor_email,
                started_at, ended_at, created_at
         FROM mkt_ai_jobs WHERE lifecycle_id = $1 ORDER BY id DESC LIMIT $2`,
        [lifecycleId, limit],
      );
      return res.rows.map((r) => this.mapJobRow(r));
    }
    return this.memory.jobs
      .filter((j) => j.lifecycle_id === lifecycleId)
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
  }

  async createJob(input: {
    lifecycle_id: number;
    job_type: MktAiJobType;
    model_name: string;
    prompt_version?: string;
    input_json: Record<string, unknown>;
    actor_email: string;
  }): Promise<MktAiJobRow> {
    const started = this.nowIso();
    const promptVersion = input.prompt_version ?? 'v1';
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO mkt_ai_jobs (
           lifecycle_id, job_type, status, prompt_version, model_name,
           input_json, actor_email, started_at, created_at, updated_at
         ) VALUES ($1, $2, 'running', $6, $3, $4::jsonb, $5, NOW(), NOW(), NOW())
         RETURNING id, lifecycle_id, job_type, status, prompt_version, model_name,
                   input_json, output_json, error_message, latency_ms, actor_email,
                   started_at, ended_at, created_at`,
        [
          input.lifecycle_id,
          input.job_type,
          input.model_name,
          JSON.stringify(input.input_json),
          input.actor_email,
          promptVersion,
        ],
      );
      return this.mapJobRow(res.rows[0]);
    }
    const id = this.memory.nextJobId++;
    const row: MktAiJobRow = {
      id,
      lifecycle_id: input.lifecycle_id,
      job_type: input.job_type,
      status: 'running',
      prompt_version: promptVersion,
      model_name: input.model_name,
      input_json: input.input_json,
      output_json: {},
      error_message: null,
      latency_ms: null,
      actor_email: input.actor_email,
      started_at: started,
      ended_at: null,
      created_at: started,
    };
    this.memory.jobs.push(row);
    return row;
  }

  async finishJob(
    jobId: number,
    patch: {
      status: MktAiJobStatus;
      output_json?: Record<string, unknown>;
      error_message?: string | null;
      latency_ms?: number;
    },
  ): Promise<MktAiJobRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE mkt_ai_jobs SET
           status = $2,
           output_json = COALESCE($3::jsonb, output_json),
           error_message = $4,
           latency_ms = $5,
           ended_at = NOW(),
           updated_at = NOW()
         WHERE id = $1
         RETURNING id, lifecycle_id, job_type, status, prompt_version, model_name,
                   input_json, output_json, error_message, latency_ms, actor_email,
                   started_at, ended_at, created_at`,
        [
          jobId,
          patch.status,
          patch.output_json ? JSON.stringify(patch.output_json) : null,
          patch.error_message ?? null,
          patch.latency_ms ?? null,
        ],
      );
      return res.rows[0] ? this.mapJobRow(res.rows[0]) : null;
    }
    const row = this.memory.jobs.find((j) => j.id === jobId);
    if (!row) return null;
    row.status = patch.status;
    if (patch.output_json) row.output_json = patch.output_json;
    row.error_message = patch.error_message ?? null;
    row.latency_ms = patch.latency_ms ?? null;
    row.ended_at = this.nowIso();
    return row;
  }

  async replaceCampaigns(lifecycleId: number, jobId: number | null, campaigns: unknown[]): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(`DELETE FROM mkt_ai_campaigns WHERE lifecycle_id = $1`, [lifecycleId]);
      for (let i = 0; i < campaigns.length; i++) {
        const c = campaigns[i] as Record<string, unknown>;
        await this.db.query(
          `INSERT INTO mkt_ai_campaigns (
             lifecycle_id, job_id, name, objective, channel_mix_json, budget_pct,
             timeline_json, milestones_json, kpis_json, sort_order
           ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10)`,
          [
            lifecycleId,
            jobId,
            String(c.name ?? ''),
            String(c.objective ?? 'lead'),
            JSON.stringify(c.channel_mix ?? []),
            Number(c.budget_pct ?? 0),
            JSON.stringify({ weeks: c.timeline_weeks ?? '' }),
            JSON.stringify(c.milestones ?? []),
            JSON.stringify(c.kpis ?? []),
            i,
          ],
        );
      }
      return;
    }
    this.memory.campaigns.set(lifecycleId, campaigns);
  }

  async replaceContentAssets(lifecycleId: number, jobId: number | null, assets: unknown[]): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(`DELETE FROM mkt_ai_content_assets WHERE lifecycle_id = $1`, [lifecycleId]);
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i] as Record<string, unknown>;
        await this.db.query(
          `INSERT INTO mkt_ai_content_assets (
             lifecycle_id, job_id, asset_type, title, body_text, content_json,
             scheduled_date, channel, sort_order
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
          [
            lifecycleId,
            jobId,
            String(a.asset_type ?? 'calendar'),
            String(a.title ?? ''),
            String(a.body_text ?? ''),
            JSON.stringify(a.content_json ?? {}),
            a.scheduled_date ? String(a.scheduled_date) : null,
            String(a.channel ?? ''),
            i,
          ],
        );
      }
      return;
    }
    this.memory.content.set(lifecycleId, assets);
  }

  async createExport(row: {
    lifecycle_id: number;
    format: string;
    exported_by: string;
    quality_score: number;
  }): Promise<{ id: number }> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO mkt_ai_exports (lifecycle_id, format, exported_by, quality_score)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [row.lifecycle_id, row.format, row.exported_by, row.quality_score],
      );
      return { id: Number(res.rows[0].id) };
    }
    const id = this.memory.exports.length + 1;
    this.memory.exports.push({ id, ...row, created_at: this.nowIso() });
    return { id };
  }

  async listDocuments(lifecycleId: number): Promise<MktAiDocumentRow[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, filename, mime_type, file_size_bytes, status, chunk_count,
                error_message, uploaded_by, created_at, updated_at
         FROM mkt_ai_documents
         WHERE lifecycle_id = $1 AND status <> 'archived'
         ORDER BY created_at DESC`,
        [lifecycleId],
      );
      return res.rows.map((r) => this.mapDocumentRow(r));
    }
    return this.memory.documents
      .filter((d) => d.lifecycle_id === lifecycleId && d.status !== 'archived')
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async findDocumentByHash(lifecycleId: number, sha256Hex: string): Promise<MktAiDocumentRow | null> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT id, lifecycle_id, filename, mime_type, file_size_bytes, status, chunk_count,
                error_message, uploaded_by, created_at, updated_at
         FROM mkt_ai_documents
         WHERE lifecycle_id = $1 AND sha256_hex = $2 AND status <> 'archived'
         ORDER BY id DESC LIMIT 1`,
        [lifecycleId, sha256Hex],
      );
      return res.rows[0] ? this.mapDocumentRow(res.rows[0]) : null;
    }
    return (
      this.memory.documents.find(
        (d) =>
          d.lifecycle_id === lifecycleId &&
          d.status !== 'archived',
      ) ?? null
    );
  }

  async insertDocument(row: {
    lifecycle_id: number;
    filename: string;
    mime_type: string;
    storage_key: string;
    file_size_bytes: number;
    sha256_hex: string;
    status: MktAiDocumentStatus;
    uploaded_by: string;
  }): Promise<MktAiDocumentRow> {
    const now = this.nowIso();
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `INSERT INTO mkt_ai_documents (
           lifecycle_id, filename, mime_type, storage_key, file_size_bytes, sha256_hex,
           status, chunk_count, uploaded_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, NOW(), NOW())
         RETURNING id, lifecycle_id, filename, mime_type, file_size_bytes, status, chunk_count,
                   error_message, uploaded_by, created_at, updated_at`,
        [
          row.lifecycle_id,
          row.filename,
          row.mime_type,
          row.storage_key,
          row.file_size_bytes,
          row.sha256_hex,
          row.status,
          row.uploaded_by,
        ],
      );
      return this.mapDocumentRow(res.rows[0]);
    }
    const doc: MktAiDocumentRow = {
      id: this.memory.nextDocumentId++,
      lifecycle_id: row.lifecycle_id,
      filename: row.filename,
      mime_type: row.mime_type,
      file_size_bytes: row.file_size_bytes,
      status: row.status,
      chunk_count: 0,
      error_message: null,
      uploaded_by: row.uploaded_by,
      created_at: now,
      updated_at: now,
    };
    this.memory.documents.push(doc);
    return doc;
  }

  async updateDocument(
    documentId: number,
    patch: {
      status: MktAiDocumentStatus;
      chunk_count: number;
      error_message: string | null;
    },
  ): Promise<MktAiDocumentRow> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `UPDATE mkt_ai_documents SET
           status = $2,
           chunk_count = $3,
           error_message = $4,
           updated_at = NOW()
         WHERE id = $1
         RETURNING id, lifecycle_id, filename, mime_type, file_size_bytes, status, chunk_count,
                   error_message, uploaded_by, created_at, updated_at`,
        [documentId, patch.status, patch.chunk_count, patch.error_message],
      );
      return this.mapDocumentRow(res.rows[0]);
    }
    const doc = this.memory.documents.find((d) => d.id === documentId);
    if (!doc) throw new Error('document_not_found');
    doc.status = patch.status;
    doc.chunk_count = patch.chunk_count;
    doc.error_message = patch.error_message;
    doc.updated_at = this.nowIso();
    return doc;
  }

  async replaceDocumentChunks(documentId: number, chunks: MktAiTextChunk[]): Promise<void> {
    if (await this.ensurePgReady()) {
      await this.db.query(`DELETE FROM mkt_ai_document_chunks WHERE document_id = $1`, [documentId]);
      for (const chunk of chunks) {
        await this.db.query(
          `INSERT INTO mkt_ai_document_chunks (
             document_id, chunk_index, page_no, title, body, token_count, metadata_json
           ) VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb)`,
          [
            documentId,
            chunk.chunk_index,
            chunk.page_no,
            chunk.title,
            chunk.body,
            chunk.token_count,
          ],
        );
      }
      return;
    }
    this.memory.chunks = this.memory.chunks.filter((c) => c.document_id !== documentId);
    for (const chunk of chunks) {
      this.memory.chunks.push({
        id: this.memory.nextChunkId++,
        document_id: documentId,
        chunk_index: chunk.chunk_index,
        page_no: chunk.page_no,
        title: chunk.title,
        body: chunk.body,
        token_count: chunk.token_count,
      });
    }
  }

  async searchDocumentChunks(
    lifecycleId: number,
    query: string,
    limit = 5,
  ): Promise<MktAiRagChunkHit[]> {
    const q = String(query ?? '').trim();
    if (!q) return this.listTopDocumentChunks(lifecycleId, limit);

    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT c.id AS chunk_id, c.document_id, c.chunk_index, c.page_no, c.title, c.body,
                d.filename,
                ts_rank(
                  to_tsvector('simple', coalesce(c.title, '') || ' ' || c.body),
                  plainto_tsquery('simple', $2)
                ) AS rank
         FROM mkt_ai_document_chunks c
         JOIN mkt_ai_documents d ON d.id = c.document_id
         WHERE d.lifecycle_id = $1
           AND d.status = 'indexed'
           AND to_tsvector('simple', coalesce(c.title, '') || ' ' || c.body) @@ plainto_tsquery('simple', $2)
         ORDER BY rank DESC, c.id ASC
         LIMIT $3`,
        [lifecycleId, q, limit],
      );
      if (res.rows.length) {
        return res.rows.map((r) => this.mapChunkHit(r));
      }
    }

    return this.searchDocumentChunksMemory(lifecycleId, q, limit);
  }

  async listTopDocumentChunks(lifecycleId: number, limit = 5): Promise<MktAiRagChunkHit[]> {
    if (await this.ensurePgReady()) {
      const res = await this.db.query(
        `SELECT c.id AS chunk_id, c.document_id, c.chunk_index, c.page_no, c.title, c.body,
                d.filename, 1.0 AS rank
         FROM mkt_ai_document_chunks c
         JOIN mkt_ai_documents d ON d.id = c.document_id
         WHERE d.lifecycle_id = $1 AND d.status = 'indexed'
         ORDER BY c.document_id ASC, c.chunk_index ASC
         LIMIT $2`,
        [lifecycleId, limit],
      );
      if (res.rows.length) {
        return res.rows.map((r) => this.mapChunkHit(r));
      }
    }
    return this.searchDocumentChunksMemory(lifecycleId, '', limit);
  }

  private searchDocumentChunksMemory(
    lifecycleId: number,
    query: string,
    limit: number,
  ): MktAiRagChunkHit[] {
    const indexedDocIds = new Set(
      this.memory.documents
        .filter((d) => d.lifecycle_id === lifecycleId && d.status === 'indexed')
        .map((d) => d.id),
    );
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = this.memory.chunks
      .filter((c) => indexedDocIds.has(c.document_id))
      .map((c) => {
        const doc = this.memory.documents.find((d) => d.id === c.document_id)!;
        const hay = `${c.title} ${c.body}`.toLowerCase();
        const rank = terms.length
          ? terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0)
          : 1;
        return {
          chunk_id: c.id,
          document_id: c.document_id,
          chunk_index: c.chunk_index,
          page_no: c.page_no,
          filename: doc.filename,
          title: c.title,
          body: c.body,
          rank,
        };
      })
      .filter((h) => h.rank > 0)
      .sort((a, b) => b.rank - a.rank || a.chunk_index - b.chunk_index)
      .slice(0, limit);
    return hits;
  }

  private mapDocumentRow(r: Record<string, unknown>): MktAiDocumentRow {
    return {
      id: Number(r.id),
      lifecycle_id: Number(r.lifecycle_id),
      filename: String(r.filename ?? ''),
      mime_type: String(r.mime_type ?? ''),
      file_size_bytes: r.file_size_bytes != null ? Number(r.file_size_bytes) : null,
      status: String(r.status ?? 'pending') as MktAiDocumentStatus,
      chunk_count: Number(r.chunk_count ?? 0),
      error_message: r.error_message != null ? String(r.error_message) : null,
      uploaded_by: String(r.uploaded_by ?? ''),
      created_at: String(r.created_at ?? this.nowIso()),
      updated_at: String(r.updated_at ?? this.nowIso()),
    };
  }

  private mapChunkHit(r: Record<string, unknown>): MktAiRagChunkHit {
    return {
      chunk_id: Number(r.chunk_id),
      document_id: Number(r.document_id),
      chunk_index: Number(r.chunk_index),
      page_no: r.page_no != null ? Number(r.page_no) : null,
      filename: String(r.filename ?? ''),
      title: String(r.title ?? ''),
      body: String(r.body ?? ''),
      rank: Number(r.rank ?? 0),
    };
  }

  private mapJobRow(r: Record<string, unknown>): MktAiJobRow {
    return {
      id: Number(r.id),
      lifecycle_id: Number(r.lifecycle_id),
      job_type: String(r.job_type) as MktAiJobType,
      status: String(r.status) as MktAiJobStatus,
      prompt_version: String(r.prompt_version ?? 'v1'),
      model_name: String(r.model_name ?? ''),
      input_json: (r.input_json as Record<string, unknown>) ?? {},
      output_json: (r.output_json as Record<string, unknown>) ?? {},
      error_message: r.error_message != null ? String(r.error_message) : null,
      latency_ms: r.latency_ms != null ? Number(r.latency_ms) : null,
      actor_email: String(r.actor_email ?? ''),
      started_at: r.started_at ? String(r.started_at) : null,
      ended_at: r.ended_at ? String(r.ended_at) : null,
      created_at: String(r.created_at ?? this.nowIso()),
    };
  }
}
