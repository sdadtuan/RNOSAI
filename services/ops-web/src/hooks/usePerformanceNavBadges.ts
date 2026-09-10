'use client';

import { useEffect, useState } from 'react';
import { fetchPmDashboard } from '@/lib/performance-api';

export type PerformanceNavBadges = {
  registry: number;
  checkIn: number;
};

const EMPTY: PerformanceNavBadges = { registry: 0, checkIn: 0 };

function parseOverdueFromQueue(queue: Array<{ title: string }>): number {
  const row = queue.find((q) => /check-in quá hạn/i.test(q.title));
  if (!row) return 0;
  const m = row.title.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

export function usePerformanceNavBadges(token: string): PerformanceNavBadges {
  const [badges, setBadges] = useState<PerformanceNavBadges>(EMPTY);

  useEffect(() => {
    if (!token) {
      setBadges(EMPTY);
      return;
    }
    void fetchPmDashboard(token)
      .then((data) => {
        setBadges({
          registry: data.total,
          checkIn: parseOverdueFromQueue(data.queue),
        });
      })
      .catch(() => setBadges(EMPTY));
  }, [token]);

  return badges;
}
