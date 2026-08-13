import type { LeadMeetingPrepResult } from './lead-meeting-prep.types';

export type IntelSourceBadge = {
  label: string;
  tone: 'live' | 'partial' | 'stub';
  detail?: string;
};

export function getIntelSourceBadge(result: LeadMeetingPrepResult | undefined): IntelSourceBadge {
  const meta = result?.meta;
  const credits = Number(meta?.tavily_credits_used ?? 0);
  const sources = Number(meta?.sources_count ?? 0);
  const partial = Boolean(meta?.partial_collect);

  if (credits > 0 && sources > 0) {
    return {
      label: partial ? 'Intel Tavily (một phần)' : 'Intel Tavily live',
      tone: partial ? 'partial' : 'live',
      detail: `${credits} credit · ${sources} nguồn`,
    };
  }

  return {
    label: 'Intel stub — chưa có Tavily',
    tone: 'stub',
    detail: 'Chạy lại prep sau khi Ops bật TAVILY_API_KEY',
  };
}
