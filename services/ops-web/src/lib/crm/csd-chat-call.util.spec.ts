import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  csdChatCallErrorMessage,
  peerLabelFromStringeeUserId,
  startCsdChatDirectCall,
} from './csd-chat-call.util';

vi.mock('@/lib/crm/csd-api', () => ({
  fetchCsdChatCallToken: vi.fn(),
  fetchCsdChatCallPresenceToken: vi.fn(),
}));

vi.mock('@/lib/stringee-web.util', () => ({
  startStringeeWebCall: vi.fn(),
  connectStringeePresence: vi.fn(),
}));

import { fetchCsdChatCallToken } from '@/lib/crm/csd-api';
import { startStringeeWebCall } from '@/lib/stringee-web.util';

describe('csd-chat-call.util', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps known errors to Vietnamese messages', () => {
    expect(csdChatCallErrorMessage(new Error('csd_call_unavailable'))).toMatch(/Stringee/);
    expect(csdChatCallErrorMessage(new Error('webrtc_unsupported'))).toMatch(/WebRTC/);
    expect(csdChatCallErrorMessage(new Error('network'))).toBe('network');
    expect(csdChatCallErrorMessage('x')).toMatch(/Không thể/);
  });

  it('formats peer label from stringee user id', () => {
    expect(peerLabelFromStringeeUserId('staff_42')).toBe('Staff #42');
    expect(peerLabelFromStringeeUserId('')).toBe('Người gọi');
  });

  it('starts stringee call with video flag and phase callbacks', async () => {
    vi.mocked(fetchCsdChatCallToken).mockResolvedValue({
      mode: 'video',
      provider: 'stringee',
      access_token: 'tok',
      from_user_id: 'staff_3',
      to_user_id: 'staff_8',
      peer_staff_id: 8,
      peer_name: 'Nguyễn Văn B',
    });
    const hangup = vi.fn();
    vi.mocked(startStringeeWebCall).mockImplementation(async (input) => {
      input.onPhase?.('ringing');
      input.onPhase?.('in_call');
      return { hangup, localMediaEl: null, remoteMediaEl: null };
    });

    const phases: string[] = [];
    const session = await startCsdChatDirectCall({
      token: 'jwt',
      conversationId: 'c1',
      mode: 'video',
      onPhase: (phase) => phases.push(phase),
      onPeerName: (name) => expect(name).toBe('Nguyễn Văn B'),
    });

    expect(fetchCsdChatCallToken).toHaveBeenCalledWith('jwt', 'c1', 'video');
    expect(startStringeeWebCall).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'tok',
        fromUserId: 'staff_3',
        toUserId: 'staff_8',
        isVideoCall: true,
      }),
    );
    expect(phases).toEqual(['connecting', 'ringing', 'in_call']);
    expect(session.hangup).toBe(hangup);
  });

  it('uses presence.makeOutboundCall when presence is provided', async () => {
    vi.mocked(fetchCsdChatCallToken).mockResolvedValue({
      mode: 'voice',
      provider: 'stringee',
      access_token: 'tok',
      from_user_id: 'staff_3',
      to_user_id: 'staff_8',
      peer_staff_id: 8,
      peer_name: 'B',
    });
    const hangup = vi.fn();
    const makeOutboundCall = vi.fn().mockResolvedValue({ hangup, localMediaEl: null, remoteMediaEl: null });

    await startCsdChatDirectCall({
      token: 'jwt',
      conversationId: 'c1',
      mode: 'voice',
      presence: { disconnect: vi.fn(), makeOutboundCall },
      onPhase: () => {},
    });

    expect(makeOutboundCall).toHaveBeenCalledWith(
      expect.objectContaining({
        fromUserId: 'staff_3',
        toUserId: 'staff_8',
        isVideoCall: false,
      }),
    );
    expect(startStringeeWebCall).not.toHaveBeenCalled();
  });

  it('throws when provider is unavailable', async () => {
    vi.mocked(fetchCsdChatCallToken).mockResolvedValue({
      mode: 'voice',
      provider: 'unavailable',
      from_user_id: 'staff_3',
      to_user_id: 'staff_8',
      peer_staff_id: 8,
      peer_name: 'B',
    });
    await expect(
      startCsdChatDirectCall({
        token: 'jwt',
        conversationId: 'c1',
        mode: 'voice',
        onPhase: () => {},
      }),
    ).rejects.toThrow('csd_call_unavailable');
  });
});
