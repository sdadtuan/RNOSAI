import { describe, expect, it } from 'vitest';
import { pickDefaultIntakeTab } from './intake-workspace-tab';

describe('pickDefaultIntakeTab', () => {
  it('handoff when completed', () => {
    expect(pickDefaultIntakeTab({ sessionStatus: 'completed', bantTotal: 0 })).toBe('handoff');
  });
  it('discovery when draft and low BANT', () => {
    expect(pickDefaultIntakeTab({ sessionStatus: 'draft', bantTotal: 8 })).toBe('discovery');
  });
  it('qualify when BANT >= 18', () => {
    expect(pickDefaultIntakeTab({ sessionStatus: 'draft', bantTotal: 18 })).toBe('qualify');
  });
});
