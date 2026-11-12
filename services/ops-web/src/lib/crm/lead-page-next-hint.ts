import { useSyncExternalStore } from 'react';

export type LeadPageNextHint = {
  claimed?: boolean;
  b2Complete?: boolean;
  presalesStage?: string | null;
  handoffStatus?: string | null;
  quotePhase?: string | null;
  quoteRejected?: boolean;
  solutionPhase?: string | null;
  revisionNote?: string | null;
  viewer?: 'sales' | 'am' | 'ceo' | 'admin' | 'other';
};

type Listener = () => void;

let hint: LeadPageNextHint | null = null;
const listeners = new Set<Listener>();

export function setLeadPageNextHint(next: LeadPageNextHint | null): void {
  hint = next;
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
