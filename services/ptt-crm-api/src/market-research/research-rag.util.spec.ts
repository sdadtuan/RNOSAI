import { readFileSync } from 'fs';
import { join } from 'path';
import { embedPlaybookText } from '../playbooks/playbooks.types';
import { RAG_CORPUS_STATUSES, RAG_EMBED_DIMS } from './market-research.types';
import type { RagEmbedInput } from './market-research.types';
import {
  embedInsightText,
  insightEmbedText,
  isRagCorpusStatus,
  rankRagHits,
  shouldSkipRagEmbed,
} from './research-rag.util';

type GoldCorpusRow = RagEmbedInput;

type GoldCase = {
  id: string;
  q: string;
  corpus: GoldCorpusRow[];
  must_include: number[];
  must_exclude: number[];
};

type GoldSet = { cases: GoldCase[] };

const goldsetPath = join(__dirname, '../../../../scripts/fixtures/research-rag-goldset.json');
const goldset = JSON.parse(readFileSync(goldsetPath, 'utf8')) as GoldSet;

function rankGoldCase(c: GoldCase) {
  const corpusIds = new Set(c.corpus.map((row) => row.insight_id));
  const rows = c.corpus.map((row) => ({
    ...row,
    project_id: 1,
    embedding: embedInsightText(insightEmbedText(row)),
    theme_codes: [] as string[],
  }));
  const hits = rankRagHits(c.q, rows);
  return { corpusIds, hits, hitIds: hits.map((h) => h.insight_id) };
}

describe('isRagCorpusStatus', () => {
  it('rejects draft and accepts published', () => {
    expect(isRagCorpusStatus('draft')).toBe(false);
    expect(isRagCorpusStatus('published')).toBe(true);
  });

  it('accepts only approved_client_facing and published', () => {
    expect(isRagCorpusStatus('approved_client_facing')).toBe(true);
    expect(isRagCorpusStatus('evidence_attached')).toBe(false);
    expect([...RAG_CORPUS_STATUSES]).toEqual(['approved_client_facing', 'published']);
  });
});

describe('embedInsightText', () => {
  it('wraps embedPlaybookText at RAG_EMBED_DIMS', () => {
    const text = 'Giá sữa học đường';
    expect(embedInsightText(text)).toEqual(embedPlaybookText(text, RAG_EMBED_DIMS));
    expect(embedInsightText(text).length).toBe(RAG_EMBED_DIMS);
  });
});

describe('shouldSkipRagEmbed', () => {
  it('skips empty text, PII, and keeps clean insight text', () => {
    expect(shouldSkipRagEmbed('')).toBe(true);
    expect(shouldSkipRagEmbed('Contact a@b.co')).toBe(true);
    expect(shouldSkipRagEmbed('Giá sữa học đường')).toBe(false);
  });
});

describe('research-rag gold-set', () => {
  it('G1 includes approved insight 1 and excludes draft 2', () => {
    const g1 = goldset.cases.find((c) => c.id === 'G1');
    expect(g1).toBeDefined();
    const { hitIds } = rankGoldCase(g1!);
    expect(hitIds).toEqual(expect.arrayContaining(g1!.must_include));
    for (const id of g1!.must_exclude) {
      expect(hitIds).not.toContain(id);
    }
  });

  it('G2 does not invent ids outside the case corpus and excludes draft', () => {
    const g2 = goldset.cases.find((c) => c.id === 'G2');
    expect(g2).toBeDefined();
    const { corpusIds, hits, hitIds } = rankGoldCase(g2!);
    for (const id of hitIds) {
      expect(corpusIds.has(id)).toBe(true);
    }
    expect(hits.every((h) => isRagCorpusStatus(h.status))).toBe(true);
    for (const id of g2!.must_exclude) {
      expect(hitIds).not.toContain(id);
    }
    for (const id of g2!.must_include) {
      expect(hitIds).toContain(id);
    }
  });

  it('every gold-set case honors must_include / must_exclude and corpus ids', () => {
    expect(goldset.cases.map((c) => c.id)).toEqual(expect.arrayContaining(['G1', 'G2']));
    for (const c of goldset.cases) {
      const { corpusIds, hits, hitIds } = rankGoldCase(c);
      for (const id of c.must_include) {
        expect(hitIds).toContain(id);
      }
      for (const id of c.must_exclude) {
        expect(hitIds).not.toContain(id);
      }
      for (const id of hitIds) {
        expect(corpusIds.has(id)).toBe(true);
      }
      expect(hits.every((h) => isRagCorpusStatus(h.status))).toBe(true);
    }
  });
});
