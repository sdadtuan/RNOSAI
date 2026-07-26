'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  SEARCH_ENTITY_LABELS,
  fetchGlobalSearch,
  type GlobalSearchHit,
  type SearchEntityType,
} from '@/lib/search-api';

const ENTITY_FILTERS: Array<{ value: '' | SearchEntityType; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'lead', label: 'Lead' },
  { value: 'deal', label: 'Deal' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'account', label: 'Account' },
  { value: 'contact', label: 'Contact' },
];

export function GlobalSearchBar() {
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState<'' | SearchEntityType>('');
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [engine, setEngine] = useState<'opensearch' | 'sqlite' | ''>('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (q: string, type: '' | SearchEntityType) => {
    const token = getAccessToken();
    if (!token || q.trim().length < 2) {
      setHits([]);
      setEngine('');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const out = await fetchGlobalSearch(token, q.trim(), {
        entity_type: type || undefined,
        limit: 12,
      });
      setHits(out.data.hits);
      setEngine(out.data.engine);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tìm kiếm thất bại');
      setHits([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSearch(query, entityType);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, entityType, runSearch]);

  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="global-search-bar" ref={wrapRef}>
      <div className="global-search-input-wrap">
        <input
          className="global-search-input"
          type="search"
          placeholder="Tìm CRM… (lead, deal, ticket)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (hits.length) setOpen(true);
          }}
          aria-label="Tìm kiếm CRM"
        />
        {busy ? <span className="global-search-spinner muted">…</span> : null}
      </div>
      <div className="global-search-filters" role="tablist" aria-label="Lọc loại thực thể">
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            className={`global-search-filter${entityType === f.value ? ' is-active' : ''}`}
            onClick={() => setEntityType(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {open && (hits.length > 0 || error || query.trim().length >= 2) ? (
        <div className="global-search-dropdown" role="listbox" aria-label="Kết quả tìm kiếm">
          {error ? <p className="global-search-empty error">{error}</p> : null}
          {!error && hits.length === 0 && query.trim().length >= 2 ? (
            <p className="global-search-empty muted">Không có kết quả</p>
          ) : null}
          {hits.map((hit) => (
            <Link
              key={`${hit.entity_type}:${hit.entity_id}`}
              href={hit.route_path ?? '/crm'}
              className="global-search-hit"
              onClick={() => setOpen(false)}
            >
              <span className="global-search-hit-type">{SEARCH_ENTITY_LABELS[hit.entity_type]}</span>
              <strong>{hit.title}</strong>
              {hit.subtitle ? <span className="muted">{hit.subtitle}</span> : null}
              {hit.snippet ? <span className="global-search-hit-snippet">{hit.snippet}</span> : null}
            </Link>
          ))}
          {engine ? (
            <p className="global-search-meta muted">
              Engine: {engine} · {hits.length} kết quả
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
