import { describe, expect, it } from 'vitest';
import { humanizeCrmApiError } from './crm-api-error';

describe('humanizeCrmApiError', () => {
  it('maps missing_cap to Vietnamese and never returns the raw code', () => {
    const out = humanizeCrmApiError('missing_cap', 'Forbidden');
    expect(out).toBe('Bạn chưa được cấp quyền thực hiện thao tác này.');
    expect(out).not.toMatch(/missing_cap/i);
  });

  it('maps client_brief_incomplete to a short Vietnamese message', () => {
    expect(humanizeCrmApiError('client_brief_incomplete', 'Thiếu tên công ty')).toBe(
      'Hồ sơ khách chưa đủ thông tin để tạo Solution bằng AI.',
    );
  });

  it('maps unknown snake_case codes instead of showing them', () => {
    const out = humanizeCrmApiError('some_unknown_code');
    expect(out).not.toMatch(/some_unknown_code/);
    expect(out).toContain('Thao tác thất bại');
  });
});
