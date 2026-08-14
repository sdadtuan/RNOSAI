'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  INSIGHT_STATUS_LABELS,
  ResearchApiError,
  searchResearchInsights,
  TRANSITION_REASON_VI,
  type ResearchRagHit,
} from '@/lib/market-research-api';
import { RAG_SEARCH_BANNER, shouldShowRagSearch } from './insights-rag.util';

export function InsightsRagSearch({
  ragEnabled,
  clientId,
}: {
  ragEnabled: boolean;
  clientId?: string;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ResearchRagHit[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  if (!shouldShowRagSearch(ragEnabled, true)) return null;

  async function onSearch() {
    const token = getAccessToken();
    if (!token) return;
    const query = q.trim();
    if (!query) {
      setHits([]);
      setNote('');
      setError(TRANSITION_REASON_VI.rag_query_required);
      return;
    }
    setSearching(true);
    setError('');
    setNote('');
    try {
      const out = await searchResearchInsights(token, {
        q: query,
        client_id: clientId,
      });
      setHits(out.hits);
      if (out.note === 'rag_disabled') {
        setNote(TRANSITION_REASON_VI.rag_disabled);
      }
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      if (api?.code && TRANSITION_REASON_VI[api.code]) {
        setError(TRANSITION_REASON_VI[api.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Tìm insight thất bại');
      }
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <p className="muted" style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>
        {RAG_SEARCH_BANNER}
      </p>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ flex: '1 1 12rem' }}>
          Tìm insight đã duyệt
          <input
            className="kpi-input"
            value={q}
            disabled={searching}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onSearch();
            }}
          />
        </label>
        <button type="button" className="btn btn-sm" disabled={searching} onClick={() => void onSearch()}>
          Tìm
        </button>
      </div>
      {error ? (
        <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
          {note}
        </p>
      ) : null}
      {hits.length > 0 ? (
        <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem' }}>
          {hits.map((hit) => (
            <li key={hit.insight_id} style={{ marginBottom: '0.35rem', fontSize: '0.85rem' }}>
              <Link href={`/crm/research/${hit.project_id}?tab=insights`}>{hit.statement}</Link>
              <span className="muted">
                {' '}
                · {hit.score.toFixed(2)} · {INSIGHT_STATUS_LABELS[hit.status] ?? hit.status}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
