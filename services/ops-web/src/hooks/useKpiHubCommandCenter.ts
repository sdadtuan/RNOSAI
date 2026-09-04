'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchKpiHubCommandCenter } from '@/lib/kpi-hub-api';
import type { CommandCenterQuery, CommandCenterResponse, CommandPersona } from '@/lib/command-center-types';
import { EMPTY_COMMAND_CENTER } from '@/lib/command-center-types';

export function useKpiHubCommandCenter(
  token: string,
  persona: CommandPersona,
  query: CommandCenterQuery = {},
) {
  const [data, setData] = useState<CommandCenterResponse>({ ...EMPTY_COMMAND_CENTER, persona });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryKey = useMemo(() => JSON.stringify({ persona, ...query }), [persona, query]);

  useEffect(() => {
    if (!token) {
      setData({ ...EMPTY_COMMAND_CENTER, persona });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchKpiHubCommandCenter(token, persona, query)
      .then((raw) => {
        if (!cancelled) setData(raw);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải được Command Center');
          setData({ ...EMPTY_COMMAND_CENTER, persona });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, queryKey, persona]);

  return { data, loading, error };
}
