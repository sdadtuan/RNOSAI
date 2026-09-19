export type OpsDodChecklistItem = {
  item: string;
  done: boolean | 'unknown';
  detail?: string;
};

export type OpsStageTransitionMeta = {
  actor: string;
  approvedAt: string;
};

export type OpsStageTransitionResult = {
  ok: true;
  wired: true;
  phase: 'P4';
  status: 'proposed' | 'transitioned';
  lifecycle_id: number;
  from_stage: string;
  to_stage: string;
  dry_run: boolean;
  dod_checklist: OpsDodChecklistItem[];
  blockers: string[];
  requires_human_approval: true;
  human_approved: boolean;
  proposal_id?: string;
  entity_ids: { lifecycle_id: number };
  links: string[];
};

/** Canonical forward order (DB keys). SRS `quote` maps to `proposal`. */
export const P4_STAGE_ORDER = [
  'lead',
  'consult',
  'proposal',
  'onboard',
  'deliver',
  'handover',
  'retain',
] as const;

export type P4Stage = (typeof P4_STAGE_ORDER)[number];
