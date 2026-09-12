export const CP_WEAVE_STATUSES = [
  'draft',
  'brief_ready',
  'opened',
  'in_weave',
  'assets_exported',
  'linked',
  'in_review',
  'approved',
  'delivered',
  'cancelled',
] as const;
export type CpWeaveStatus = (typeof CP_WEAVE_STATUSES)[number];

export type CpWeaveBrief = {
  creative_brief: string;
  prompt: string;
  negative_prompt: string;
  shot_list: string[];
  output_format: { kind: 'image' | 'video' | 'carousel'; width: number; height: number; notes?: string };
};

export type CpWeaveLane = 'source' | 'drafts' | 'review' | 'approved' | 'final';

const TRANSITIONS: Record<CpWeaveStatus, readonly CpWeaveStatus[]> = {
  draft: ['brief_ready', 'cancelled'],
  brief_ready: ['opened', 'cancelled'],
  opened: ['in_weave', 'assets_exported', 'cancelled'],
  in_weave: ['assets_exported', 'cancelled'],
  assets_exported: ['linked', 'cancelled'],
  linked: ['in_review', 'assets_exported', 'cancelled'],
  in_review: ['approved', 'linked', 'cancelled'],
  approved: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function canTransitionWeave(from: CpWeaveStatus, to: CpWeaveStatus): boolean {
  return TRANSITIONS[from]?.includes(to) === true;
}
