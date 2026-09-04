import { describe, expect, it } from 'vitest';
import { wizardFooter } from './delivery-wizard.util';

describe('wizardFooter', () => {
  it('save when no delivery capability', () => {
    expect(wizardFooter([])).toEqual({ primary: 'save', showSteps2to5: false });
    expect(wizardFooter(['lead_ingest'])).toEqual({ primary: 'save', showSteps2to5: false });
  });

  it('continue scope when delivery is on', () => {
    expect(wizardFooter(['delivery'])).toEqual({ primary: 'continue_scope', showSteps2to5: true });
    expect(wizardFooter(['lead_ingest', 'delivery'])).toEqual({
      primary: 'continue_scope',
      showSteps2to5: true,
    });
  });
});
