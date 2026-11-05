'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchKpiHubDashboard } from '@/lib/kpi-hub-api';
import { KPI_HUB_DASHBOARD } from '@/lib/kpi-hub-fixtures';
import { dashboardFiltersToQuery, normalizeDashboard } from '@/lib/kpi-hub-normalize';
import type { KpiHubDashboardData, KpiHubDashboardFilters } from '@/lib/kpi-hub-types';

export function useKpiHubDashboard(token: string, filters: KpiHubDashboardFilters = {}) {
  const [data, setData] = useState<KpiHubDashboardData>(KPI_HUB_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => dashboardFiltersToQuery(filters as Record<string, string>), [filters]);
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    if (!token) {
      setData(KPI_HUB_DASHBOARD);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchKpiHubDashboard(token, query)
      .then((raw) => {
        if (!cancelled) {
          setData(normalizeDashboard(raw));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải được dashboard');
          setData(KPI_HUB_DASHBOARD);
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

  return { data, loading, error };
}
