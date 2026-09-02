import { suggestPriorityFromText } from './csd-chat-keyword.util';

describe('suggestPriorityFromText', () => {
  it('suggests P1 for urgent outage keywords', () => {
    expect(suggestPriorityFromText('Ads ngưng chạy')).toBe('P1');
    expect(suggestPriorityFromText('Sự cố sập landing')).toBe('P1');
  });

  it('suggests P2 for error keywords', () => {
    expect(suggestPriorityFromText('Campaign lỗi spend')).toBe('P2');
  });

  it('returns null for normal text', () => {
    expect(suggestPriorityFromText('Sửa banner')).toBe(null);
  });
});
