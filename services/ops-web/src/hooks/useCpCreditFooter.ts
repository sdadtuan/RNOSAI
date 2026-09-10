'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { getOverviewKpis, type CpScope } from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

export type CpCreditFooterState = {
  used: string;
  limit: string;
  loading: boolean;
};

function formatCredit(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return dash(null);
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

export function useCpCreditFooter(scope: CpScope = 'me'): CpCreditFooterState {
  const [state, setState] = useState<CpCreditFooterState>({
    used: dash(null),
    limit: dash(null),
    loading: true,
  });

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ used: dash(null), limit: dash(null), loading: false });
      return;
    }
    try {
      const out = await getOverviewKpis(token, { scope });
      const used = out.kpis.credits_used;
      const remaining = out.kpis.credits_remaining;
      const limit =
        used != null && remaining != null && Number.isFinite(used + remaining)
          ? used + remaining
          : null;
      setState({
        used: formatCredit(used),
        limit: formatCredit(limit),
        loading: false,
      });
    } catch {
      setState({ used: dash(null), limit: dash(null), loading: false });
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  return state;
}
