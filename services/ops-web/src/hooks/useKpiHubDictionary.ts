'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchKpiHubDictionary } from '@/lib/kpi-hub-api';
import { KPI_HUB_DICT_SUMMARY, KPI_HUB_DICTIONARY, type KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';
import { normalizeDictionaryList } from '@/lib/kpi-hub-normalize';
import type { KpiHubDictSummary } from '@/lib/kpi-hub-types';

type DictionaryQuery = {
  q?: string;
  group?: string;
  owner?: string;
  status?: string;
};

export function useKpiHubDictionary(token: string, query: DictionaryQuery = {}) {
  const [rows, setRows] = useState<KpiHubDictionaryRow[]>(KPI_HUB_DICTIONARY);
  const [summary, setSummary] = useState<KpiHubDictSummary>(KPI_HUB_DICT_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiQuery = useMemo(() => {
    const out: Record<string, string> = {};
    if (query.q) out.q = query.q;
    if (query.group) out.group = query.group;
    if (query.owner) out.owner = query.owner;
    if (query.status) out.status = query.status;
    out.page_size = '100';
    out.page = '1';
    return out;
  }, [query.group, query.owner, query.q, query.status]);

  const queryKey = JSON.stringify(apiQuery);

  useEffect(() => {
    if (!token) {
      setRows(KPI_HUB_DICTIONARY);
      setSummary(KPI_HUB_DICT_SUMMARY);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchKpiHubDictionary(token, apiQuery)
      .then((raw) => {
        if (!cancelled) {
          const normalized = normalizeDictionaryList(raw as Record<string, unknown>);
          setRows(normalized.data);
          setSummary(normalized.summary);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải được danh sách KPI');
          setRows(KPI_HUB_DICTIONARY);
          setSummary(KPI_HUB_DICT_SUMMARY);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, queryKey]);

  return { rows, summary, loading, error };
}
