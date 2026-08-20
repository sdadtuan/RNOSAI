import { assertStageTransition } from './vd-stage.guard';

describe('vd-stage.guard', () => {
  it('allows staying on brief_draft', () => {
    expect(() => assertStageTransition('brief_draft', 'brief_draft')).not.toThrow();
  });

  it('blocks S1 jump to keyframing', () => {
    expect(() => assertStageTransition('brief_draft', 'keyframing')).toThrow(/stage_guard/);
  });
});
