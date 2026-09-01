import {
  isIgnorableInbound,
  needsEmailApproval,
  parseTicketCodeFromSubject,
} from './csd-email-match.util';

describe('csd-email-match.util', () => {
  describe('parseTicketCodeFromSubject', () => {
    it('parses bracketed ticket code', () => {
      expect(parseTicketCodeFromSubject('Re: [PTT-2026-000123] Website down')).toBe('PTT-2026-000123');
    });

    it('parses unbracketed ticket code', () => {
      expect(parseTicketCodeFromSubject('Fwd PTT-2026-000456 issue')).toBe('PTT-2026-000456');
    });

    it('returns null when no code', () => {
      expect(parseTicketCodeFromSubject('Hello team')).toBeNull();
    });
  });

  describe('isIgnorableInbound', () => {
    it('ignores auto-submitted mail', () => {
      expect(isIgnorableInbound({ 'Auto-Submitted': 'auto-replied' })).toBe(true);
    });

    it('allows auto-submitted=no', () => {
      expect(isIgnorableInbound({ 'Auto-Submitted': 'no' })).toBe(false);
    });

    it('ignores bulk precedence', () => {
      expect(isIgnorableInbound({ Precedence: 'bulk' })).toBe(true);
      expect(isIgnorableInbound({ precedence: 'junk' })).toBe(true);
    });
  });

  describe('needsEmailApproval', () => {
    it('flags báo giá keyword', () => {
      expect(needsEmailApproval('Báo giá gói SEO', '')).toBe(true);
    });

    it('flags hoàn tiền in body', () => {
      expect(needsEmailApproval('Update', 'Chúng tôi yêu cầu hoàn tiền')).toBe(true);
    });

    it('flags khiếu nại', () => {
      expect(needsEmailApproval('', 'Khiếu nại dịch vụ')).toBe(true);
    });

    it('returns false for routine mail', () => {
      expect(needsEmailApproval('Cập nhật tiến độ tuần', 'Dự án đang chạy ổn')).toBe(false);
    });
  });
});
