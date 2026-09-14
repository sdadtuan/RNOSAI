import { fetchCsdChatCallToken, type CsdChatCallMode } from '@/lib/crm/csd-api';
import { startStringeeWebCall, type StringeeCallSession } from '@/lib/stringee-web.util';

export type CsdChatCallPhase = 'idle' | 'connecting' | 'ringing' | 'in_call' | 'ended' | 'error';

export type CsdChatCallState = {
  phase: CsdChatCallPhase;
  mode: CsdChatCallMode | null;
  peerName: string;
  error: string;
};

export const CSD_CHAT_CALL_IDLE: CsdChatCallState = {
  phase: 'idle',
  mode: null,
  peerName: '',
  error: '',
};

export async function startCsdChatDirectCall(input: {
  token: string;
  conversationId: string;
  mode: CsdChatCallMode;
  onPhase: (phase: CsdChatCallPhase) => void;
  onPeerName?: (peerName: string) => void;
}): Promise<StringeeCallSession> {
  input.onPhase('connecting');
  const out = await fetchCsdChatCallToken(input.token, input.conversationId, input.mode);
  input.onPeerName?.(out.peer_name);
  if (out.provider !== 'stringee' || !out.access_token) {
    throw new Error('csd_call_unavailable');
  }
  return startStringeeWebCall({
    accessToken: out.access_token,
    fromUserId: out.from_user_id,
    toUserId: out.to_user_id,
    isVideoCall: input.mode === 'video',
    onSignal: (event) => {
      if (event === 'ringing') input.onPhase('ringing');
      if (event === 'answered') input.onPhase('in_call');
      if (event === 'ended') input.onPhase('ended');
    },
  });
}

export function csdChatCallErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'csd_call_unavailable') {
      return 'Chưa bật Stringee WebRTC (PTT_B2B_CPAAS=stringee). Liên hệ IT.';
    }
    if (err.message === 'webrtc_unsupported') {
      return 'Trình duyệt không hỗ trợ WebRTC.';
    }
    return err.message;
  }
  return 'Không thể bắt đầu cuộc gọi.';
}
