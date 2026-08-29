import {
  cosineSimilarity,
  embedPlaybookText,
  keywordScore,
} from '../playbooks/playbooks.types';

export type SalesKitHit = {
  file_id: string;
  file_name: string;
  folder_path: string;
  excerpt: string;
  score: number;
  kind: 'qa' | 'battle_card' | 'case' | 'pricing' | 'session_upload' | 'other';
  body: string;
  is_session: boolean;
};

type SalesKitRow = {
  body: string;
  title: string;
  file_id: string;
  file_name: string;
  folder_path: string;
  kind: SalesKitHit['kind'];
  is_session: boolean;
  parse_status: string;
};

export function scoreSalesKitChunks(input: {
  query: string;
  rows: SalesKitRow[];
  limit?: number;
}): SalesKitHit[] {
  const q = String(input.query ?? '').trim();
  const limit = Math.max(Number(input.limit ?? 5) || 5, 0);
  const queryVec = embedPlaybookText(q);

  const hits = input.rows
    .filter((row) => row.parse_status === 'ready')
    .map((row) => {
      const text = `${row.title} ${row.body}`;
      const vectorScore = cosineSimilarity(queryVec, embedPlaybookText(text));
      const kw = keywordScore(q, text);
      let score = vectorScore * 0.7 + kw;
      if (row.is_session) score += 0.2;
      return {
        file_id: row.file_id,
        file_name: row.file_name,
        folder_path: row.folder_path,
        excerpt: row.body.slice(0, 120),
        score,
        kind: row.kind,
        body: row.body,
        is_session: row.is_session,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return hits;
}

export function qaAnswerFromBody(body: string): string {
  const match = body.match(/^A:\s*(.*)/m);
  return match ? match[1]!.trim() : body;
}
