import { describe, expect, it } from 'vitest';
import {
  avatarHue,
  csdChatLetterKey,
  groupCsdChatPeopleByLetter,
  formatChatListTime,
  formatCsdStorageDayLabel,
  formatDateChip,
  groupCsdMediaItemsByDay,
  initialsFromName,
  isCsdChatImageMime,
  isCsdChatMediaMime,
  splitCsdConversationAttachments,
  resolveCsdConversationAvatar,
  resolveCsdMessagePeer,
  resolveCsdPersonAvatar,
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

  it('groups media items by VN day label', () => {
    const groups = groupCsdMediaItemsByDay([
      {
        file: {
          id: '1',
          file_name: 'a.png',
          mime_type: 'image/png',
          byte_size: 1,
          visibility: 'internal',
        },
        messageId: 'm1',
        createdAt: '2026-09-12T10:00:00+07:00',
      },
      {
        file: {
          id: '2',
          file_name: 'b.png',
          mime_type: 'image/png',
          byte_size: 1,
          visibility: 'internal',
        },
        messageId: 'm2',
        createdAt: '2026-09-10T10:00:00+07:00',
      },
    ]);
    expect(groups).toHaveLength(2);
    expect(formatCsdStorageDayLabel('2026-09-12T10:00:00+07:00')).toBe('Ngày 12 Tháng 9');
    expect(groups[0]?.[0]).toBe('Ngày 12 Tháng 9');
    expect(groups[1]?.[0]).toBe('Ngày 10 Tháng 9');
  });

  it('groups media by day newest-first across months', () => {
    const groups = groupCsdMediaItemsByDay([
      {
        file: { id: '1', file_name: 'old.png', mime_type: 'image/png', byte_size: 1, visibility: 'internal' },
        messageId: 'm1',
        createdAt: '2026-09-05T10:00:00+07:00',
      },
      {
        file: { id: '2', file_name: 'new.png', mime_type: 'image/png', byte_size: 1, visibility: 'internal' },
        messageId: 'm2',
        createdAt: '2026-10-02T10:00:00+07:00',
      },
    ]);
    expect(groups.map(([label]) => label)).toEqual(['Ngày 2 Tháng 10', 'Ngày 5 Tháng 9']);
  });

  it('sorts items within the same day newest-first', () => {
    const groups = groupCsdMediaItemsByDay([
      {
        file: { id: '1', file_name: 'early.png', mime_type: 'image/png', byte_size: 1, visibility: 'internal' },
        messageId: 'm1',
        createdAt: '2026-09-12T08:00:00+07:00',
      },
      {
        file: { id: '2', file_name: 'late.png', mime_type: 'image/png', byte_size: 1, visibility: 'internal' },
        messageId: 'm2',
        createdAt: '2026-09-12T18:00:00+07:00',
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.[1].map((item) => item.file.file_name)).toEqual(['late.png', 'early.png']);
  });

  it('splitCsdConversationAttachments groups media and files newest-first', () => {
    expect(isCsdChatMediaMime('video/mp4')).toBe(true);
    const out = splitCsdConversationAttachments([
      {
        id: '1',
        file_name: 'a.png',
        mime_type: 'image/png',
        byte_size: 1,
        visibility: 'internal',
        message_id: 'm1',
        created_at: '2026-09-02T10:00:00.000Z',
      },
      {
        id: '2',
        file_name: 'b.pdf',
        mime_type: 'application/pdf',
        byte_size: 2,
        visibility: 'internal',
        message_id: 'm2',
        created_at: '2026-09-02T11:00:00.000Z',
      },
    ]);
    expect(out.images).toHaveLength(1);
    expect(out.files).toHaveLength(1);
    expect(out.files[0]?.file.file_name).toBe('b.pdf');
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

  it('groups friends alphabetically for Zalo-style contacts', () => {
    expect(csdChatLetterKey('Anh Tuấn')).toBe('A');
    expect(groupCsdChatPeopleByLetter([
      { display_name_vi: 'Bình' },
      { display_name_vi: 'Anh' },
    ])).toEqual([
      ['A', [{ display_name_vi: 'Anh' }]],
      ['B', [{ display_name_vi: 'Bình' }]],
    ]);
  });

  it('resolveCsdConversationAvatar maps direct peer photo metadata', () => {
    expect(
      resolveCsdConversationAvatar({
        id: 'conv-1',
        avatar_staff_id: 8,
        avatar_has_photo: true,
        avatar_updated_at: '2026-09-12T00:00:00.000Z',
      }),
    ).toEqual({
      staffId: 8,
      hasAvatar: true,
      avatarUpdatedAt: '2026-09-12T00:00:00.000Z',
      seed: 8,
    });
  });

  it('resolveCsdPersonAvatar maps staff avatar metadata', () => {
    expect(
      resolveCsdPersonAvatar({
        staff_id: 12,
        has_avatar: true,
        avatar_updated_at: '2026-09-12T01:00:00.000Z',
      }),
    ).toEqual({
      staffId: 12,
      hasAvatar: true,
      avatarUpdatedAt: '2026-09-12T01:00:00.000Z',
      seed: 12,
    });
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
