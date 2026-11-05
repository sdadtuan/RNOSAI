'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchServiceKpiInstances } from '@/lib/service-kpi-api';
import type { ServiceKpiInstanceItem } from '@/lib/service-kpi-types';

export function useServiceKpiInstances(
  token: string,
  query: { source_type?: string; source_id?: string; status?: string; dv_code?: string } = {},
) {
  const [items, setItems] = useState<ServiceKpiInstanceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const queryKey = useMemo(() => JSON.stringify({ ...query, refreshKey }), [query, refreshKey]);

  useEffect(() => {
    if (!token) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchServiceKpiInstances(token, query)
      .then((res) => {
        if (!cancelled) {
          setItems(res.items);
          setTotal(res.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được instances');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, queryKey]);

  return { items, total, loading, error, refresh: () => setRefreshKey((k) => k + 1) };
}
