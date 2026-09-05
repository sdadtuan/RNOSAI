export type AmOnboardingTabId =
  | 'overview'
  | 'checklist'
  | 'milestones'
  | 'stakeholders'
  | 'documents'
  | 'activity';

export type AmOnboardingTab = {
  id: AmOnboardingTabId;
  label: string;
};

export const AM_ONBOARDING_TABS: AmOnboardingTab[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'stakeholders', label: 'Stakeholders' },
  { id: 'documents', label: 'Tài liệu' },
  { id: 'activity', label: 'Activity' },
];

export type AmOnboardingTrack = 'on_track' | 'at_risk' | 'blocked';

export const AM_ONBOARDING_TRACK_COPY: Record<AmOnboardingTrack, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  blocked: 'Blocked',
};

export type AmGoLiveItem = {
  required?: boolean;
  done?: boolean;
};

export function parseAmOnboardingTab(raw: string | null | undefined): AmOnboardingTabId {
  const hit = AM_ONBOARDING_TABS.find((tab) => tab.id === raw);
  return hit?.id ?? 'overview';
}

export function amGoLiveBlocked(items: AmGoLiveItem[] | null | undefined, override?: boolean): boolean {
  if (override) return false;
  return (items ?? []).some((item) => item.required === true && item.done !== true);
}

export function amRequiredOpenCount(items: AmGoLiveItem[] | null | undefined): {
  required: number;
  done: number;
} {
  const requiredItems = (items ?? []).filter((item) => item.required === true);
  return {
    required: requiredItems.length,
    done: requiredItems.filter((item) => item.done === true).length,
  };
}

export function amTrackCopy(track: string | null | undefined): string {
  if (track === 'on_track' || track === 'at_risk' || track === 'blocked') {
    return AM_ONBOARDING_TRACK_COPY[track];
  }
  return track || '—';
}

export function amOnboardingDash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function formatAmOnboardingDate(value: string | null | undefined): string {
  if (!value) return '—';
  const ymd = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
