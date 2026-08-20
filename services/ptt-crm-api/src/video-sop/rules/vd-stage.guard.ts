export type VdProjectStage =
  | 'brief_draft' | 'brief_ready' | 'ideation' | 'scripting' | 'shotlist_ready'
  | 'keyframing' | 'animating' | 'post_production' | 'delivered' | 'archived';

export function assertStageTransition(from: VdProjectStage, to: VdProjectStage): void {
  if (from === to) return;
  throw new Error('stage_guard');
}
