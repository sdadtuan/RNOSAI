import { describe, expect, it } from 'vitest';
import { detectContentApproveSod, sodBlocksMatrixSave } from './sod-rules';

const sodGrants = {
  crm_seo_aeo_write: ['edit'],
  crm_seo_aeo_approve: ['approve'],
};

describe('sodBlocksMatrixSave', () => {
  it('does not lock save when SoD-01 already exists on the position', () => {
    const next = {
      ...sodGrants,
      crm_am: ['view', 'view_all', 'edit', 'assign', 'manage'],
    };
    expect(detectContentApproveSod(sodGrants)).not.toBeNull();
    expect(sodBlocksMatrixSave(sodGrants, next)).toBeNull();
  });

  it('blocks save when the edit newly introduces SoD-01', () => {
    const baseline = { crm_am: ['view'] };
    const next = { ...baseline, ...sodGrants };
    const blocked = sodBlocksMatrixSave(baseline, next);
    expect(blocked?.id).toBe('01');
  });

  it('allows save when current grants have no SoD', () => {
    expect(sodBlocksMatrixSave({}, { crm_am: ['view'] })).toBeNull();
  });
});
