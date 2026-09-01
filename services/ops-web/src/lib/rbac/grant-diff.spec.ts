import { describe, expect, it } from 'vitest';
import {
  PERMISSION_MATRIX_ACTIONS,
  permissionActionLabel,
} from './grant-diff';

describe('grant-diff matrix columns', () => {
  it('includes CEO act and GDKD extra actions', () => {
    expect(PERMISSION_MATRIX_ACTIONS).toContain('act');
    expect(PERMISSION_MATRIX_ACTIONS).toContain('override');
    expect(PERMISSION_MATRIX_ACTIONS).toContain('review_queue');
    expect(PERMISSION_MATRIX_ACTIONS).toContain('view_all_leads');
  });

  it('labels act for ceo_command matrix column', () => {
    expect(permissionActionLabel('act')).toBe('Điều hành (Xác nhận)');
    expect(permissionActionLabel('review_queue')).toBe('Review queue');
  });
});
