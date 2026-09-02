import { describe, expect, it } from 'vitest';
import {
  avatarHue,
  formatChatListTime,
  formatDateChip,
  initialsFromName,
  isCsdChatImageMime,
  shouldShowDateChip,
} from './csd-chat-display';

describe('csd-chat-display', () => {
  it('initialsFromName takes two letters', () => {
    expect(initialsFromName('Nguyễn Văn An')).toBe('NA');
    expect(initialsFromName('')).toBe('KH');
    expect(initialsFromName(null)).toBe('KH');
  });

  it('avatarHue is stable 0-359', () => {
    expect(avatarHue(8)).toBe(avatarHue(8));
    expect(avatarHue(8)).toBeGreaterThanOrEqual(0);
    expect(avatarHue(8)).toBeLessThan(360);
  });

  it('formats list time and date chips in VN', () => {
    const now = new Date('2026-09-02T10:00:00+07:00');
    expect(formatChatListTime('2026-09-02T08:05:00+07:00', now)).toMatch(/08:05/);
    expect(formatChatListTime('2026-09-01T08:05:00+07:00', now)).toBe('Hôm qua');
    expect(formatDateChip('2026-09-02T08:05:00+07:00', now)).toBe('Hôm nay');
    expect(shouldShowDateChip('2026-09-01T23:00:00+07:00', '2026-09-02T01:00:00+07:00')).toBe(true);
    expect(shouldShowDateChip('2026-09-02T01:00:00+07:00', '2026-09-02T08:00:00+07:00')).toBe(false);
  });

  it('isCsdChatImageMime only matches image/*', () => {
    expect(isCsdChatImageMime('image/png')).toBe(true);
    expect(isCsdChatImageMime('IMAGE/JPEG')).toBe(true);
    expect(isCsdChatImageMime('application/pdf')).toBe(false);
    expect(isCsdChatImageMime(null)).toBe(false);
  });
});
