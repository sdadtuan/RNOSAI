export const CP_QC_PACK_IDS = ['bds_social', 'lead_social', 'tvc_short'] as const;
export type CpQcPackId = (typeof CP_QC_PACK_IDS)[number];

export const CP_PLAYBOOK_IDS = [
  'bds_social_916',
  'lead_social_916',
  'tvc_short_169',
] as const;
export type CpPlaybookId = (typeof CP_PLAYBOOK_IDS)[number];

export type CpPlaybookLine = 'PL-1' | 'PL-2' | 'PL-3';

export type CpPlaybookSource = 're_project_products' | 'manual';

export type CpChannelProfile =
  | 'meta_reels_916'
  | 'meta_feed_45'
  | 'meta_square_11'
  | 'youtube_169'
  | 'meta_916_cutdown';

export type CpPlaybookDefinition = {
  id: CpPlaybookId;
  line: CpPlaybookLine;
  label: string;
  template_slug: string;
  qc_pack: CpQcPackId;
  channels: CpChannelProfile[];
  vars: string[];
  source: CpPlaybookSource;
  script_beats?: string[];
  sop_handoff?: boolean;
};

export type CpPlaybookVars = Record<string, string | number | boolean | null | undefined>;

export type CpPlaybookRunInput = {
  source?: CpPlaybookSource | string;
  rows?: Array<Record<string, unknown>>;
  re_project_id?: number | string;
  project_id?: string;
  mapping?: Record<string, string>;
};

export type CpPlaybookScene = {
  idx: number;
  title: string | null;
  t_start: number | null;
  t_end: number | null;
  visual: string | null;
  vo: string | null;
  overlay: string | null;
  locked?: boolean;
  beat?: string | null;
};
