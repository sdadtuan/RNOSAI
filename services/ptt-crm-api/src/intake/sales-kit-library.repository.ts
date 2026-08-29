import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { embedPlaybookText } from '../playbooks/playbooks.types';
import type { IngestChunk } from './sales-kit-ingest.util';
import type { SalesKitHit } from './sales-kit-retrieve.util';

export type SalesKitReadyChunkRow = {
  file_id: string;
  file_name: string;
  folder_path: string;
  title: string;
  body: string;
  kind: SalesKitHit['kind'];
  is_session: boolean;
  parse_status: string;
  lead_id: number | null;
  session_id: number | null;
  embedding?: number[] | null;
};

export type SalesKitReadyChunkFilter = {
  serviceSlug: string;
  leadId?: number | null;
  sessionId?: number | null;
};

export type SalesKitFileRow = {
  id: string;
  playbook_id: string | null;
  lead_id: number | null;
  session_id: number | null;
  folder_key: string;
  original_name: string;
  mime: string;
  storage_key: string;
  parse_status: string;
  parse_error: string | null;
  uploaded_by: number | null;
  created_at: string;
};

function kindFromFolder(folderKey: string, isSession: boolean): SalesKitHit['kind'] {
  if (isSession) return 'session_upload';
  if (folderKey.includes('/qa')) return 'qa';
  if (folderKey.includes('/battle-cards')) return 'battle_card';
  if (folderKey.includes('/cases')) return 'case';
  if (folderKey.includes('/pricing')) return 'pricing';
  return 'other';
}

function mapFile(row: Record<string, unknown>): SalesKitFileRow {
  return {
    id: String(row.id ?? ''),
    playbook_id: row.playbook_id != null ? String(row.playbook_id) : null,
    lead_id: row.lead_id != null ? Number(row.lead_id) : null,
    session_id: row.session_id != null ? Number(row.session_id) : null,
    folder_key: String(row.folder_key ?? ''),
    original_name: String(row.original_name ?? ''),
    mime: String(row.mime ?? ''),
    storage_key: String(row.storage_key ?? ''),
    parse_status: String(row.parse_status ?? ''),
    parse_error: row.parse_error != null ? String(row.parse_error) : null,
    uploaded_by: row.uploaded_by != null ? Number(row.uploaded_by) : null,
    created_at: String(row.created_at ?? ''),
  };
}

const FILE_SELECT = `id::text, playbook_id::text, lead_id, session_id, folder_key,
  original_name, mime, storage_key, parse_status, parse_error, uploaded_by, created_at`;

function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw) && raw.every((n) => typeof n === 'number')) {
    return raw as number[];
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
        return parsed as number[];
      }
    } catch {
      return null;
    }
  }
  return null;
}

@Injectable()
export class SalesKitLibraryRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private tableReadyCached: boolean | null = null;

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
    if (this.tableReadyCached) return true;
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'sales_kit_files'
         LIMIT 1`,
      );
      const ok = (result.rowCount ?? result.rows.length) > 0;
      if (ok) this.tableReadyCached = true;
      return ok;
    } catch {
      return false;
    }
  }

  async listReadyChunks(filter?: SalesKitReadyChunkFilter): Promise<SalesKitReadyChunkRow[]> {
    if (!(await this.tableReady())) return [];
    const params: unknown[] = [];
    let extra = '';
    if (filter) {
      params.push(filter.serviceSlug);
      extra += ` AND (
        f.folder_key = $1
        OR f.folder_key LIKE $1 || '/%'
        OR f.folder_key = '_common'
        OR f.folder_key LIKE '_common/%'`;
      if (filter.leadId != null && filter.sessionId != null) {
        params.push(filter.leadId, filter.sessionId);
        extra += ` OR (f.lead_id = $2 AND f.session_id = $3)`;
      }
      extra += `)`;
    }
    const result = await this.db.query(
      `SELECT f.id::text AS file_id,
              f.original_name AS file_name,
              f.folder_key AS folder_path,
              f.lead_id,
              f.session_id,
              f.parse_status,
              c.title,
              c.body,
              c.embedding_json
       FROM sales_kit_files f
       JOIN ai_playbooks p ON p.id = f.playbook_id
       JOIN ai_playbook_chunks c ON c.playbook_id = p.id
         AND c.chunk_key LIKE ('file:' || f.id::text || ':%')
       WHERE f.parse_status = 'ready'
         AND p.status = 'active'
         AND p.category = 'sales_kit'${extra}`,
      params,
    );
    return result.rows.map((row) => {
      const leadId = row.lead_id != null ? Number(row.lead_id) : null;
      const sessionId = row.session_id != null ? Number(row.session_id) : null;
      const folder = String(row.folder_path ?? '');
      const isSession = leadId != null || folder.startsWith('session/');
      return {
        file_id: String(row.file_id ?? ''),
        file_name: String(row.file_name ?? ''),
        folder_path: folder,
        title: String(row.title ?? ''),
        body: String(row.body ?? ''),
        kind: kindFromFolder(folder, isSession),
        is_session: isSession,
        parse_status: String(row.parse_status ?? ''),
        lead_id: leadId,
        session_id: sessionId,
        embedding: parseEmbedding(row.embedding_json),
      };
    });
  }

  async countFilesByFolder(folderKey: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM sales_kit_files WHERE folder_key = $1`,
      [folderKey],
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  async countFilesBySession(leadId: number, sessionId: number): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM sales_kit_files
       WHERE lead_id = $1 AND session_id = $2`,
      [leadId, sessionId],
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  async insertFile(input: {
    playbookId: string;
    leadId: number | null;
    sessionId: number | null;
    folderKey: string;
    originalName: string;
    mime: string;
    storageKey: string;
    parseStatus: string;
    uploadedBy: number | null;
  }): Promise<SalesKitFileRow> {
    const result = await this.db.query(
      `INSERT INTO sales_kit_files (
         playbook_id, lead_id, session_id, folder_key, original_name, mime,
         storage_key, parse_status, uploaded_by
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${FILE_SELECT}`,
      [
        input.playbookId,
        input.leadId,
        input.sessionId,
        input.folderKey,
        input.originalName,
        input.mime,
        input.storageKey,
        input.parseStatus,
        input.uploadedBy,
      ],
    );
    return mapFile(result.rows[0]);
  }

  async updateFileStorage(id: string, storageKey: string): Promise<void> {
    await this.db.query(`UPDATE sales_kit_files SET storage_key = $2 WHERE id = $1`, [
      id,
      storageKey,
    ]);
  }

  async updateFileParse(
    id: string,
    parseStatus: string,
    parseError: string | null,
  ): Promise<void> {
    await this.db.query(
      `UPDATE sales_kit_files SET parse_status = $2, parse_error = $3 WHERE id = $1`,
      [id, parseStatus, parseError],
    );
  }

  async listFiles(opts: { folderKey?: string; sessionId?: number }): Promise<SalesKitFileRow[]> {
    if (opts.sessionId != null) {
      const result = await this.db.query(
        `SELECT ${FILE_SELECT} FROM sales_kit_files
         WHERE session_id = $1
         ORDER BY created_at DESC`,
        [opts.sessionId],
      );
      return result.rows.map(mapFile);
    }
    if (opts.folderKey) {
      const result = await this.db.query(
        `SELECT ${FILE_SELECT} FROM sales_kit_files
         WHERE folder_key = $1
         ORDER BY created_at DESC`,
        [opts.folderKey],
      );
      return result.rows.map(mapFile);
    }
    return [];
  }

  async findFileById(id: string): Promise<SalesKitFileRow | null> {
    const result = await this.db.query(
      `SELECT ${FILE_SELECT} FROM sales_kit_files WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapFile(result.rows[0]) : null;
  }

  async ensurePlaybook(input: {
    slug: string;
    title: string;
    tags: string[];
    status: 'draft' | 'active';
    createdBy: string | null;
  }): Promise<{ id: string; status: string }> {
    const existing = await this.db.query(
      `SELECT id::text, status FROM ai_playbooks WHERE slug = $1 LIMIT 1`,
      [input.slug],
    );
    if (existing.rows[0]) {
      const id = String(existing.rows[0].id);
      if (input.status === 'active') {
        await this.db.query(
          `UPDATE ai_playbooks SET status = 'active', updated_at = NOW() WHERE id = $1::uuid`,
          [id],
        );
        return { id, status: 'active' };
      }
      return {
        id,
        status: String(existing.rows[0].status ?? ''),
      };
    }
    const inserted = await this.db.query(
      `INSERT INTO ai_playbooks (slug, title, category, summary, tags, created_by, status)
       VALUES ($1, $2, 'sales_kit', '', $3::jsonb, $4, $5)
       RETURNING id::text, status`,
      [input.slug, input.title, JSON.stringify(input.tags), input.createdBy, input.status],
    );
    return {
      id: String(inserted.rows[0].id),
      status: String(inserted.rows[0].status ?? input.status),
    };
  }

  async insertChunks(playbookId: string, fileId: string, chunks: IngestChunk[]): Promise<void> {
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i]!;
      const chunkKey = `file:${fileId}:${chunk.chunk_key}`.slice(0, 64);
      const title = chunk.title || chunk.chunk_key;
      const body = chunk.body;
      const embedding = embedPlaybookText(`${title} ${body}`);
      const tokenCount = body.trim().split(/\s+/).filter(Boolean).length;
      await this.db.query(
        `INSERT INTO ai_playbook_chunks (
           playbook_id, chunk_key, title, body, embedding_json, token_count, sort_order
         ) VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7)
         ON CONFLICT (playbook_id, chunk_key) DO UPDATE SET
           title = EXCLUDED.title,
           body = EXCLUDED.body,
           embedding_json = EXCLUDED.embedding_json,
           token_count = EXCLUDED.token_count,
           updated_at = NOW()`,
        [playbookId, chunkKey, title, body, JSON.stringify(embedding), tokenCount, i],
      );
    }
    await this.db.query(`UPDATE ai_playbooks SET updated_at = NOW() WHERE id = $1::uuid`, [
      playbookId,
    ]);
  }

  async approveFile(id: string): Promise<SalesKitFileRow | null> {
    const file = await this.findFileById(id);
    if (!file) return null;
    const updated = await this.db.query(
      `UPDATE sales_kit_files SET parse_status = 'ready', parse_error = NULL
       WHERE id = $1 AND parse_status = 'pending'
       RETURNING ${FILE_SELECT}`,
      [id],
    );
    if (!updated.rows[0]) return null;
    if (file.playbook_id) {
      await this.db.query(
        `UPDATE ai_playbooks SET status = 'active', updated_at = NOW() WHERE id = $1::uuid`,
        [file.playbook_id],
      );
    }
    return mapFile(updated.rows[0]);
  }
}
