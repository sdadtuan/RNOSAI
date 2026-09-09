'use client';

import { useEffect, useState } from 'react';
import { fetchServiceKpiTrackingDashboard } from '@/lib/service-kpi-api';
import type { ServiceKpiTrackingDashboard } from '@/lib/service-kpi-types';

const EMPTY: ServiceKpiTrackingDashboard = {
  summary: {
    today_total: 0,
    verified_pct: 0,
    api_connector_total: 0,
    api_connector_hint: '—',
    manual_import_total: 0,
    pending_verify: 0,
    data_issues: 0,
    stale_count: 0,
    duplicate_count: 0,
  },
  recent: [],
  highlight: null,
};

export function useServiceKpiTracking(token: string, highlightInstanceId?: string) {
  const [data, setData] = useState<ServiceKpiTrackingDashboard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!token) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchServiceKpiTrackingDashboard(token, highlightInstanceId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải tracking');
          setData(EMPTY);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, highlightInstanceId, refreshKey]);

  return {
    summary: data.summary,
    recent: data.recent,
    highlight: data.highlight,
    loading,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
