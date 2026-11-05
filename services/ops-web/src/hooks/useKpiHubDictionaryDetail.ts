'use client';

import { useEffect, useState } from 'react';
import { fetchKpiHubDictionaryItem } from '@/lib/kpi-hub-api';
import type { KpiHubDictionaryRow } from '@/lib/kpi-hub-fixtures';
import { KPI_HUB_DICTIONARY } from '@/lib/kpi-hub-fixtures';
import { normalizeDictionaryItem } from '@/lib/kpi-hub-normalize';

export function useKpiHubDictionaryDetail(token: string, id: string | null) {
  const [row, setRow] = useState<KpiHubDictionaryRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setRow(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fallback = KPI_HUB_DICTIONARY.find((r) => r.id === id || r.code.toLowerCase() === id.toLowerCase()) ?? null;

    if (!token) {
      setRow(fallback);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchKpiHubDictionaryItem(token, id)
      .then((raw) => {
        if (!cancelled) {
          const normalized = normalizeDictionaryItem(raw as Record<string, unknown>);
          setRow(normalized ?? fallback);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải được chi tiết KPI');
          setRow(fallback);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, id]);

  return { row, loading, error };
}
