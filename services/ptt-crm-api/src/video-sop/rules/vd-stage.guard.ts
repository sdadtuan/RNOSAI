export type VdProjectStage =
  | 'brief_draft' | 'brief_ready' | 'ideation' | 'scripting' | 'shotlist_ready'
  | 'keyframing' | 'animating' | 'post_production' | 'delivered' | 'archived';

const ALLOWED: ReadonlyArray<readonly [VdProjectStage, VdProjectStage]> = [
  ['brief_draft', 'brief_ready'],
  ['brief_ready', 'ideation'],
  ['brief_ready', 'scripting'],
  ['ideation', 'scripting'],
];

export function assertStageTransition(from: VdProjectStage, to: VdProjectStage): void {
  if (from === to) return;
  if (ALLOWED.some(([a, b]) => a === from && b === to)) return;
  throw new Error('stage_guard');
}
