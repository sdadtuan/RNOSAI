import { describe, expect, it } from 'vitest';
import { detectScopeConflicts } from './delivery-conflicts';

describe('detectScopeConflicts', () => {
  it('flags creative without brand note and crm without access note', () => {
    expect(detectScopeConflicts(['creative_production'])).toContain('creative_missing_brand_guideline');
    expect(detectScopeConflicts(['crm_automation'])).toContain('crm_access_unconfirmed');
    expect(detectScopeConflicts(['performance_marketing'])).toEqual([]);
  });
});
