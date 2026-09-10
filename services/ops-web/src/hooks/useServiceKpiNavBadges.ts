'use client';

import { useEffect, useState } from 'react';
import { fetchServiceKpiWarRoom } from '@/lib/service-kpi-api';

export type ServiceKpiNavBadges = {
  warRoom: number;
  contract: number;
  sideNoteBody: string;
};

const EMPTY: ServiceKpiNavBadges = {
  warRoom: 0,
  contract: 0,
  sideNoteBody: '',
};

export function useServiceKpiNavBadges(token: string): ServiceKpiNavBadges {
  const [badges, setBadges] = useState<ServiceKpiNavBadges>(EMPTY);

  useEffect(() => {
    if (!token) {
      setBadges(EMPTY);
      return;
    }
    void fetchServiceKpiWarRoom(token)
      .then((data) => {
        const warRoom = data.critical_overdue + data.quotes_score_gte_70;
        const contract = data.quotes_score_gte_70;
        const sideNoteBody = `${contract} quote score ≥70 chờ duyệt cùng GM · ${data.blocked_reports} report bị chặn actual Unverified · ${data.assumptions_open} assumption khách chưa confirm.`;
        setBadges({ warRoom, contract, sideNoteBody });
      })
      .catch(() => setBadges(EMPTY));
  }, [token]);

  return badges;
}
