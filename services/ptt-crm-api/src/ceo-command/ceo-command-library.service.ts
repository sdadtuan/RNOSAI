import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { normalizeQueryText } from '../ai-intelligence/nl-query.engine';

export type CeoLibraryChunk = {
  chunk_id: string;
  file_name: string;
  folder_path: string;
  excerpt: string;
  kind: 'policy' | 'qa' | 'metric_note';
  score: number;
};

export function scoreCeoChunks(
  question: string,
  chunks: Array<{
    id: string;
    file_name: string;
    folder_path: string;
    excerpt: string;
    kind?: string;
  }>,
): CeoLibraryChunk[] {
  const q = normalizeQueryText(question);
  const qTokens = new Set(q.split(' ').filter(Boolean));
  return chunks
    .map((c) => {
      const corpus = normalizeQueryText(`${c.file_name} ${c.excerpt}`);
      const tokens = corpus.split(' ').filter(Boolean);
      let score = 0;
      for (const t of tokens) {
        if (qTokens.has(t)) score += 1;
      }
      const kindRaw = String(c.kind ?? 'qa');
      const kind: CeoLibraryChunk['kind'] =
        kindRaw === 'policy' || kindRaw === 'metric_note' ? kindRaw : 'qa';
      return {
        chunk_id: c.id,
        file_name: c.file_name,
        folder_path: c.folder_path,
        excerpt: c.excerpt,
        kind,
        score,
      };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

@Injectable()
export class CeoCommandLibraryService implements OnModuleDestroy {
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

  async retrieve(question: string): Promise<CeoLibraryChunk[]> {
    try {
      const result = await this.db.query(
        `SELECT c.id::text, f.file_name, f.folder_path, c.content AS excerpt, c.kind
         FROM ai_playbook_chunks c
         JOIN ai_playbooks f ON f.id = c.playbook_id
         WHERE f.status = 'active' AND COALESCE(f.category, 'sales') = 'ceo_os'
         ORDER BY c.updated_at DESC
         LIMIT 200`,
      );
      return scoreCeoChunks(
        question,
        result.rows.map((r) => ({
          id: String(r.id),
          file_name: String(r.file_name ?? ''),
          folder_path: String(r.folder_path ?? ''),
          excerpt: String(r.excerpt ?? '').slice(0, 800),
          kind: String(r.kind ?? 'qa'),
        })),
      );
    } catch {
      return [];
    }
  }
}
