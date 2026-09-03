import { describe, expect, it } from 'vitest';
import {
  avatarHue,
  formatChatListTime,
  formatDateChip,
  initialsFromName,
  isCsdChatImageMime,
  resolveCsdMessagePeer,
  shiftBoxIntoFrame,
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

  it('resolveCsdMessagePeer prefers conversation name over Khách', () => {
    const peer = resolveCsdMessagePeer(
      { author_staff_id: 8, author_staff_name: null },
      { active: { id: 'conv-1', kind: 'direct', name_vi: 'Anh Tuấn CS' }, members: [] },
    );
    expect(peer.name).toBe('Anh Tuấn CS');
    expect(peer.seed).toBe('conv-1');
  });

  it('resolveCsdMessagePeer uses author name when present', () => {
    const peer = resolveCsdMessagePeer(
      { author_staff_id: 8, author_staff_name: 'Nguyễn Văn B', author_has_avatar: true },
      { active: { id: 'conv-1', kind: 'group', name_vi: 'Nhóm AM' }, members: [] },
    );
    expect(peer.name).toBe('Nguyễn Văn B');
    expect(peer.hasAvatar).toBe(true);
  });

  it('shiftBoxIntoFrame pushes a clipped popover back inside both edges', () => {
    const frame = { left: 100, right: 400, top: 50, bottom: 500 };
    expect(shiftBoxIntoFrame({ left: 70, right: 250, top: 80, bottom: 120 }, frame, 8)).toEqual({
      x: 38,
      y: 0,
    });
    expect(shiftBoxIntoFrame({ left: 280, right: 430, top: 80, bottom: 120 }, frame, 8)).toEqual({
      x: -38,
      y: 0,
    });
    expect(shiftBoxIntoFrame({ left: 140, right: 260, top: 80, bottom: 120 }, frame, 8)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
