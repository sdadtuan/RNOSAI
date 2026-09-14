import { describe, expect, it, vi } from 'vitest';
import { csdChatCallErrorMessage, startCsdChatDirectCall } from './csd-chat-call.util';

vi.mock('@/lib/crm/csd-api', () => ({
  fetchCsdChatCallToken: vi.fn(),
}));

vi.mock('@/lib/stringee-web.util', () => ({
  startStringeeWebCall: vi.fn(),
}));

import { fetchCsdChatCallToken } from '@/lib/crm/csd-api';
import { startStringeeWebCall } from '@/lib/stringee-web.util';

describe('csd-chat-call.util', () => {
  it('maps known errors to Vietnamese messages', () => {
    expect(csdChatCallErrorMessage(new Error('csd_call_unavailable'))).toMatch(/Stringee/);
    expect(csdChatCallErrorMessage(new Error('webrtc_unsupported'))).toMatch(/WebRTC/);
    expect(csdChatCallErrorMessage(new Error('network'))).toBe('network');
    expect(csdChatCallErrorMessage('x')).toMatch(/Không thể/);
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
      input.onSignal?.('ringing');
      input.onSignal?.('answered');
      return { hangup };
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
