import { canTransitionWeave } from './cp-weave.types';
import { normalizeWeaveBrief } from './cp-weave-brief.util';

describe('normalizeWeaveBrief', () => {
  it('throws when prompt is missing', () => {
    expect(() => normalizeWeaveBrief({
      creative_brief: 'Mid-autumn feed',
      negative_prompt: 'blur',
      shot_list: ['hero'],
      output_format: { kind: 'image', width: 1080, height: 1080 },
    })).toThrow();
  });

  it('normalizes a valid brief', () => {
    expect(normalizeWeaveBrief({
      creative_brief: 'Mid-autumn feed',
      prompt: 'lanterns at night',
      negative_prompt: 'blur',
      shot_list: ['hero'],
      output_format: { kind: 'image', width: 1080, height: 1080 },
    })).toEqual({
      creative_brief: 'Mid-autumn feed',
      prompt: 'lanterns at night',
      negative_prompt: 'blur',
      shot_list: ['hero'],
      output_format: { kind: 'image', width: 1080, height: 1080 },
    });
  });
});

describe('canTransitionWeave', () => {
  it('allows draft to brief_ready and rejects draft to approved', () => {
    expect(canTransitionWeave('draft', 'brief_ready')).toBe(true);
    expect(canTransitionWeave('draft', 'approved')).toBe(false);
  });
});
