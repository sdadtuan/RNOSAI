import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import {
  AM_360_TABS,
  am360HasForbiddenTabs,
  am360LoadErrorCopy,
  am360LoadErrorKind,
  am360PatchToast,
  am360WaveCopy,
  canEditAmAccountName,
  parseAm360Tab,
} from './am-account-360.util';

function user(caps: StoredStaffUser['caps']): StoredStaffUser {
  return { id: '1', email: 'a', display_name: 'A', position_id: 1, caps };
}

describe('AM_360_TABS', () => {
  it('has exactly 10 tabs and no Ads/Portal', () => {
    expect(AM_360_TABS).toHaveLength(10);
    expect(AM_360_TABS.map((tab) => tab.label)).toEqual([
      'Tổng quan',
      'Timeline',
      'Dự án & dịch vụ',
      'Công việc',
      'Hợp đồng & Tài chính',
      'Health & Risk',
      'Cơ hội',
      'Phản hồi',
      'Tài liệu',
      'Audit',
    ]);
    expect(am360HasForbiddenTabs()).toBe(false);
  });

  it('implements overview, finance, audit and Wave 3 timeline', () => {
    const implemented = AM_360_TABS.filter((tab) => tab.implemented).map((tab) => tab.id);
    expect(implemented).toEqual(['overview', 'timeline', 'finance', 'audit']);
    expect(am360WaveCopy(AM_360_TABS.find((tab) => tab.id === 'timeline')!)).toBe('');
    expect(am360WaveCopy(AM_360_TABS.find((tab) => tab.id === 'opportunities')!)).toBe(
      'Cơ hội — mở ở Wave 4',
    );
  });

  it('defaults unknown tab query to overview', () => {
    expect(parseAm360Tab('ads')).toBe('overview');
    expect(parseAm360Tab('finance')).toBe('finance');
  });

  it('uses scope-not-found copy only for HTTP 404', () => {
    expect(am360LoadErrorKind(404)).toBe('not_found');
    expect(am360LoadErrorKind(500)).toBe('load_failed');
    expect(am360LoadErrorKind(undefined)).toBe('load_failed');
    expect(am360LoadErrorCopy('not_found')).toBe('Không tìm thấy khách trong phạm vi của bạn.');
    expect(am360LoadErrorCopy('load_failed')).toBe('Không tải được Account 360. Thử lại.');
    expect(am360LoadErrorCopy('load_failed')).not.toBe(am360LoadErrorCopy('not_found'));
  });

  it('does not toast success when name is unchanged without crm_agency write', () => {
    expect(canEditAmAccountName(user([{ section: 'crm_am', action: 'edit' }]))).toBe(false);
    expect(canEditAmAccountName(user([{ section: 'crm_agency', action: 'write' }]))).toBe(true);
    const toast = am360PatchToast({ nameRequested: true, nameUnchanged: true });
    expect(toast.tone).not.toBe('success');
    expect(toast.message).toMatch(/tên không đổi/i);
    expect(toast.message).toMatch(/crm_agency/i);
    expect(am360PatchToast({ nameRequested: false, nameUnchanged: false }).tone).toBe('success');
  });
});
