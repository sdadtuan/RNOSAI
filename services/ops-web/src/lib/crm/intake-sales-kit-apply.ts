import type { IntakeSalesKitOutput } from '@/lib/api';
import { BANT_KEYS } from '@/lib/crm/intake-bant';
import {
  updateDiscoveryResponse,
  type DiscoveryChecklistState,
} from '@/lib/crm/intake-discovery';
import { WIN_INTEL_KEYS, type WinIntelState } from '@/lib/crm/intake-win-intel';

export type SalesKitApplySelected = {
  discovery: boolean;
  winIntel: boolean;
  bantHints: boolean;
};

export function applySalesKitToForm(
  current: { discovery: DiscoveryChecklistState; winIntel: WinIntelState; bant: Record<string, number> },
  apply: IntakeSalesKitOutput['apply'],
  selected: SalesKitApplySelected,
): typeof current {
  let discovery = current.discovery;
  let winIntel = current.winIntel;
  const bant = { ...current.bant };

  if (selected.discovery && apply.discovery?.length) {
    for (const item of apply.discovery) {
      const key = String(item.key ?? '').trim();
      if (!key) continue;
      discovery = updateDiscoveryResponse(
        discovery,
        key,
        { answer: String(item.answer ?? ''), asked: true },
        discovery.mode,
      );
    }
  }

  if (selected.winIntel && apply.win_intel) {
    const next = { ...winIntel };
    let changed = false;
    for (const key of WIN_INTEL_KEYS) {
      const raw = apply.win_intel[key];
      if (typeof raw !== 'string') continue;
      next[key] = { ...next[key], answer: raw };
      changed = true;
    }
    if (changed) winIntel = next;
  }

  if (selected.bantHints && apply.bant_hints) {
    for (const key of BANT_KEYS) {
      const n = Number(apply.bant_hints[key]);
      if (!Number.isFinite(n)) continue;
      bant[key] = n;
    }
  }

  return { discovery, winIntel, bant };
}
