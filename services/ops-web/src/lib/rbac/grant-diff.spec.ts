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

  it('includes Account Management view_all and manage columns', () => {
    expect(PERMISSION_MATRIX_ACTIONS).toContain('view_all');
    expect(PERMISSION_MATRIX_ACTIONS).toContain('manage');
    expect(permissionActionLabel('view_all')).toBe('Xem tất cả');
    expect(permissionActionLabel('manage')).toBe('Quản lý');
  });

  it('labels act for ceo_command matrix column', () => {
    expect(permissionActionLabel('act')).toBe('Điều hành (Xác nhận)');
    expect(permissionActionLabel('review_queue')).toBe('Review queue');
  });

  it('includes Content OS matrix columns', () => {
    for (const action of ['publish', 'approve_internal', 'qa', 'production', 'admin']) {
      expect(PERMISSION_MATRIX_ACTIONS).toContain(action);
    }
    expect(permissionActionLabel('publish')).toBe('Xuất bản');
    expect(permissionActionLabel('approve_internal')).toBe('Duyệt nội bộ');
  });

  it('includes CP/IMG execute and IWR matrix columns', () => {
    for (const action of ['execute', 'view_team', 'finance_request', 'query', 'commit', 'review', 'simulate']) {
      expect(PERMISSION_MATRIX_ACTIONS).toContain(action);
    }
    expect(permissionActionLabel('execute')).toBe('Thực thi');
    expect(permissionActionLabel('org')).toBe('Phạm vi org');
  });

  it('includes Meta Ads Ops submit column', () => {
    expect(PERMISSION_MATRIX_ACTIONS).toContain('submit');
    expect(permissionActionLabel('submit')).toBe('Gửi / submit ops');
  });
});
