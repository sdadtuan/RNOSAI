'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  fetchContentOsBridgeSeoStatus,
  fetchContentOsCalendar,
  fetchContentOsContext,
  fetchContentOsDerivations,
  fetchContentOsItemComments,
  fetchContentOsItemDeliverables,
  fetchContentOsItemVersions,
  fetchContentOsPillars,
  fetchPlanSnapshot,
  type ContentOsCalendarSlot,
  type ContentOsComment,
  type ContentOsContext,
  type ContentOsDerivation,
  type ContentOsItem,
  type ContentOsItemVersion,
  type ContentOsPillar,
  type ContentOsPlanSnapshot,
} from '@/lib/content-os-api';
import { fetchPortfolioItem } from './cmkte-api';
import { filterMasterDeliverables } from '@/components/content-os/cmkte/cmkte-deliverables';

export type CmktItemBundle = {
  item: ContentOsItem | null;
  missing: boolean;
  loading: boolean;
  error: string;
  comments: ContentOsComment[];
  versions: ContentOsItemVersion[];
  pillars: ContentOsPillar[];
  derivations: ContentOsDerivation[];
  deliverables: ContentOsItem[];
  seo: { linked: boolean; seo_content_id: number | null; workflow_status: string | null; href: string | null } | null;
  slots: ContentOsCalendarSlot[];
  context: ContentOsContext | null;
  plan: ContentOsPlanSnapshot | null;
  reload: () => void;
};

const empty: Omit<CmktItemBundle, 'reload'> = {
  item: null,
  missing: false,
  loading: false,
  error: '',
  comments: [],
  versions: [],
  pillars: [],
  derivations: [],
  deliverables: [],
  seo: null,
  slots: [],
  context: null,
  plan: null,
};

export function useCmktItem(itemId: number, lifecycleHint?: number): CmktItemBundle {
  const [state, setState] = useState<Omit<CmktItemBundle, 'reload'>>({ ...empty, loading: itemId > 0 });
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!(itemId > 0)) {
      setState({ ...empty, missing: true });
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setState({ ...empty, missing: true, error: 'Thiếu phiên đăng nhập.' });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: '', missing: false }));
    void (async () => {
      try {
        const item = await fetchPortfolioItem(token, itemId, lifecycleHint);
        if (cancelled) return;
        const lifecycleId = item.lifecycle_id;
        const [comments, versions, pillars, derivations, deliverables, seo, calendar, context, plan] =
          await Promise.all([
          fetchContentOsItemComments(token, lifecycleId, item.id).catch(() => ({ comments: [] })),
          fetchContentOsItemVersions(token, lifecycleId, item.id).catch(() => ({ versions: [] })),
          fetchContentOsPillars(token, lifecycleId).catch(() => ({ pillars: [] })),
          fetchContentOsDerivations(token, lifecycleId, item.id).catch(() => ({ derivations: [] })),
          fetchContentOsItemDeliverables(token, lifecycleId, item.id).catch(() => ({ items: [] })),
          fetchContentOsBridgeSeoStatus(token, lifecycleId, item.id).catch(() => null),
          fetchContentOsCalendar(token, lifecycleId).catch(() => ({ slots: [] })),
          fetchContentOsContext(token, lifecycleId).catch(() => null),
          fetchPlanSnapshot(token, lifecycleId).catch(() => null),
        ]);
        if (cancelled) return;
        setState({
          item,
          missing: false,
          loading: false,
          error: '',
          comments: comments.comments ?? [],
          versions: versions.versions ?? [],
          pillars: pillars.pillars ?? [],
          derivations: derivations.derivations ?? [],
          deliverables: filterMasterDeliverables(deliverables.items ?? [], item.id),
          seo,
          slots: (calendar.slots ?? []).filter((slot) => slot.item_id === item.id),
          context,
          plan,
        });
      } catch {
        if (!cancelled) {
          setState({ ...empty, missing: true, error: '' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, lifecycleHint, tick]);

  return { ...state, reload };
}
