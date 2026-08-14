import { cosineSimilarity, embedPlaybookText, keywordScore } from '../playbooks/playbooks.types';
import { piiHint } from './evidence-immutable.util';
import {
  RAG_CORPUS_STATUSES,
  RAG_EMBED_DIMS,
  type RagCorpusStatus,
  type RagEmbedInput,
  type RagHit,
} from './market-research.types';

export function isRagCorpusStatus(status: string): status is RagCorpusStatus {
  return (RAG_CORPUS_STATUSES as readonly string[]).includes(status);
}

export function insightEmbedText(row: Pick<RagEmbedInput, 'statement' | 'observation'>): string {
  return `${row.statement ?? ''} ${row.observation ?? ''}`.replace(/\s+/g, ' ').trim();
}

export function embedInsightText(text: string, dims = RAG_EMBED_DIMS): number[] {
  return embedPlaybookText(text, dims);
}

export function shouldSkipRagEmbed(text: string): boolean {
  return !text.trim() || piiHint(text);
}

function themeFilterMatches(
  needle: string | undefined,
  codes: string[],
  synonyms: string[] = [],
): boolean {
  if (!needle) return true;
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  return (
    codes.some((code) => code.toLowerCase() === n) ||
    synonyms.some((syn) => syn.toLowerCase() === n)
  );
}

export function rankRagHits(
  query: string,
  rows: Array<
    RagEmbedInput & {
      project_id: number;
      embedding: number[];
      theme_codes: string[];
      theme_synonyms?: string[];
    }
  >,
  opts?: { theme_code?: string; limit?: number; minScore?: number },
): RagHit[] {
  const minScore = opts?.minScore ?? 0.12;
  const limit = opts?.limit ?? 10;
  const queryVec = embedInsightText(query);
  const hits: RagHit[] = [];

  for (const row of rows) {
    if (!isRagCorpusStatus(row.status)) continue;
    if (!themeFilterMatches(opts?.theme_code, row.theme_codes, row.theme_synonyms)) continue;
    const score = 0.7 * cosineSimilarity(queryVec, row.embedding) + 0.3 * keywordScore(query, row.statement);
    if (score < minScore) continue;
    hits.push({
      insight_id: row.insight_id,
      project_id: row.project_id,
      statement: row.statement,
      status: row.status,
      score,
      theme_codes: row.theme_codes,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
