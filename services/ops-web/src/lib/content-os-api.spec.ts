import { describe, expect, it } from 'vitest';
import { CmktApiError, parseCmktGateError } from './content-os-api';

describe('parseCmktGateError', () => {
  it('keeps generate-path copy when brief_incomplete has no score', () => {
    const err = new CmktApiError(
      'Brief thiếu audience hoặc goal — bổ sung trước khi generate.',
      400,
      'brief_incomplete',
      { error: 'brief_incomplete', missing_fields: ['audience'] },
    );
    expect(parseCmktGateError(err)).toBe(
      'Brief thiếu audience hoặc goal — bổ sung trước khi generate.',
    );
  });

  it('shows score and threshold for submit-review brief_incomplete', () => {
    const err = new CmktApiError('brief_incomplete', 400, 'brief_incomplete', {
      error: 'brief_incomplete',
      score: 40,
      threshold: 80,
    });
    expect(parseCmktGateError(err)).toBe(
      'Brief chưa đủ (40/80) — bổ sung trước khi gửi duyệt.',
    );
  });

  it('maps brief_locked to Vietnamese copy', () => {
    const err = new CmktApiError('brief_locked', 409, 'brief_locked', {
      error: 'brief_locked',
    });
    expect(parseCmktGateError(err)).toBe(
      'Brief đã khóa — cần force version để sửa.',
    );
  });
});
