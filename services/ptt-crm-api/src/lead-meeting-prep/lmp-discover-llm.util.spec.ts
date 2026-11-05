import { validateDiscoverResultShape } from './lmp-discover-llm.util';

describe('validateDiscoverResultShape', () => {
  it('accepts not_found payload', () => {
    expect(() =>
      validateDiscoverResultShape({
        discover_status: 'not_found',
        discover_message_vi: 'Không tìm thấy DN công khai từ SĐT/email.',
        candidates: [],
        meta: { prompt_version: 'lmp-discover-v1' },
      }),
    ).not.toThrow();
  });

  it('rejects wrong prompt version', () => {
    expect(() =>
      validateDiscoverResultShape({
        discover_status: 'not_found',
        discover_message_vi: 'x',
        candidates: [],
        meta: { prompt_version: 'other' },
      }),
    ).toThrow();
  });
});
