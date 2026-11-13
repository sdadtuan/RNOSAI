import { useSyncExternalStore } from 'react';

export type LeadPageNextHint = {
  claimed?: boolean;
  /** Configured Sales claim window, used in the chrome banner. */
  claimMinutes?: number;
  b2Complete?: boolean;
  presalesStage?: string | null;
  handoffStatus?: string | null;
  quotePhase?: string | null;
  quoteRejected?: boolean;
  solutionPhase?: string | null;
  revisionNote?: string | null;
  viewer?: 'sales' | 'am' | 'ceo' | 'admin' | 'other';
  /** Hide the StaffPageShell "Bước tiếp" chrome (AM Chờ Solutions desk matches the mockup). */
  hideBanner?: boolean;
};

type Listener = () => void;

let hint: LeadPageNextHint | null = null;
let claimMinutesCache: number | undefined;
const listeners = new Set<Listener>();

export function setLeadPageClaimMinutes(minutes: number | null | undefined): void {
  const n = Number(minutes);
  claimMinutesCache = Number.isFinite(n) && n >= 0 ? n : undefined;
  if (hint) {
    hint = { ...hint, claimMinutes: claimMinutesCache };
    listeners.forEach((listen) => listen());
  }
}

export function getLeadPageClaimMinutes(): number | undefined {
  return claimMinutesCache;
}

/** Flip the chrome banner as soon as Sales claims, without waiting for a lead refetch. */
export function setLeadPageClaimed(claimed: boolean): void {
  hint = hint ? { ...hint, claimed } : { claimed, claimMinutes: claimMinutesCache };
  listeners.forEach((listen) => listen());
}

export function setLeadPageNextHint(next: LeadPageNextHint | null): void {
  hint = next && claimMinutesCache != null ? { ...next, claimMinutes: next.claimMinutes ?? claimMinutesCache } : next;
  listeners.forEach((listen) => listen());
}

export function getLeadPageNextHint(): LeadPageNextHint | null {
  return hint;
}

export function subscribeLeadPageNextHint(listen: Listener): () => void {
  listeners.add(listen);
  return () => {
    listeners.delete(listen);
  };
}

export function useLeadPageNextHint(): LeadPageNextHint | null {
  return useSyncExternalStore(subscribeLeadPageNextHint, getLeadPageNextHint, () => null);
}
