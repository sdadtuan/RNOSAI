'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchServiceKpiTemplates } from '@/lib/service-kpi-api';
import type { ServiceKpiTemplateListItem, ServiceKpiTemplatesResponse } from '@/lib/service-kpi-types';

const EMPTY: ServiceKpiTemplatesResponse = {
  items: [],
  total: 0,
  summary: { active: 0, in_review: 0 },
};

export function useServiceKpiTemplates(
  token: string,
  query: { dv_code?: string; status?: string } = {},
) {
  const [data, setData] = useState<ServiceKpiTemplatesResponse>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const apiQuery = useMemo(() => {
    const out: { dv_code?: string; status?: string } = {};
    if (query.dv_code) out.dv_code = query.dv_code;
    if (query.status) out.status = query.status;
    return out;
  }, [query.dv_code, query.status]);

  const queryKey = JSON.stringify({ apiQuery, refreshKey });

  useEffect(() => {
    if (!token) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchServiceKpiTemplates(token, apiQuery)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải được template');
          setData(EMPTY);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, queryKey, apiQuery]);

  return {
    items: data.items as ServiceKpiTemplateListItem[],
    summary: data.summary,
    total: data.total,
    loading,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
