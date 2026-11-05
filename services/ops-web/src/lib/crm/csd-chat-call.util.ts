import {
  fetchCsdChatCallPresenceToken,
  fetchCsdChatCallToken,
  type CsdChatCallMode,
} from '@/lib/crm/csd-api';
import {
  connectStringeePresence,
  startStringeeWebCall,
  type StringeeCallSession,
  type StringeeIncomingCall,
  type StringeePresenceSession,
} from '@/lib/stringee-web.util';
import type { StringeeUxPhase } from '@/lib/stringee-signaling.util';

export type CsdChatCallPhase =
  | 'idle'
  | 'connecting'
  | 'ringing'
  | 'incoming'
  | 'in_call'
  | 'ended'
  | 'error';

export type CsdChatCallState = {
  phase: CsdChatCallPhase;
  mode: CsdChatCallMode | null;
  peerName: string;
  error: string;
  direction: 'outbound' | 'inbound' | null;
};

export const CSD_CHAT_CALL_IDLE: CsdChatCallState = {
  phase: 'idle',
  mode: null,
  peerName: '',
  error: '',
  direction: null,
};

function uxPhaseToCallPhase(phase: StringeeUxPhase): CsdChatCallPhase | null {
  if (phase === 'connecting') return 'connecting';
  if (phase === 'ringing') return 'ringing';
  if (phase === 'in_call') return 'in_call';
  if (phase === 'ended' || phase === 'busy') return 'ended';
  return null;
}

export async function startCsdChatDirectCall(input: {
  token: string;
  conversationId: string;
  mode: CsdChatCallMode;
  onPhase: (phase: CsdChatCallPhase) => void;
  onPeerName?: (peerName: string) => void;
  /** Prefer shared presence client so inbound listening stays alive. */
  presence?: StringeePresenceSession | null;
}): Promise<StringeeCallSession> {
  input.onPhase('connecting');
  const out = await fetchCsdChatCallToken(input.token, input.conversationId, input.mode);
  input.onPeerName?.(out.peer_name);
  if (out.provider !== 'stringee' || !out.access_token) {
    throw new Error('csd_call_unavailable');
  }

  const onPhase = (ux: StringeeUxPhase) => {
    const mapped = uxPhaseToCallPhase(ux);
    if (mapped) input.onPhase(mapped);
  };

  if (input.presence) {
    return input.presence.makeOutboundCall({
      fromUserId: out.from_user_id,
      toUserId: out.to_user_id,
      isVideoCall: input.mode === 'video',
      onPhase,
    });
  }

  return startStringeeWebCall({
    accessToken: out.access_token,
    fromUserId: out.from_user_id,
    toUserId: out.to_user_id,
    isVideoCall: input.mode === 'video',
    onPhase,
    onSignal: (event) => {
      if (event === 'ringing') input.onPhase('ringing');
      if (event === 'answered') input.onPhase('in_call');
      if (event === 'ended') input.onPhase('ended');
    },
  });
}

export async function startCsdChatCallPresence(input: {
  token: string;
  onIncoming: (incoming: StringeeIncomingCall) => void;
}): Promise<StringeePresenceSession | null> {
  const out = await fetchCsdChatCallPresenceToken(input.token);
  if (out.provider !== 'stringee' || !out.access_token) {
    return null;
  }
  return connectStringeePresence({
    accessToken: out.access_token,
    onIncoming: input.onIncoming,
  });
}

export function csdChatCallPermissionMessage(err: unknown, mode: 'voice' | 'video'): string | null {
  if (!err || typeof err !== 'object') return null;
  const name = 'name' in err ? String((err as { name?: string }).name) : '';
  const message = err instanceof Error ? err.message : '';
  const denied =
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    /notallowed|permission denied/i.test(message);
  if (!denied) return null;
  return mode === 'video' ? 'Cần quyền camera để gọi video' : 'Cần quyền micro để gọi';
}

export function csdChatCallErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'csd_call_unavailable') {
      return 'Chưa bật Stringee WebRTC (PTT_B2B_CPAAS=stringee). Liên hệ IT.';
    }
    if (err.message === 'webrtc_unsupported') {
      return 'Trình duyệt không hỗ trợ WebRTC.';
    }
    if (err.message === 'stringee_busy' || err.message.toLowerCase().includes('busy')) {
      return 'Máy bận / người nhận từ chối.';
    }
    return err.message;
  }
  return 'Không thể bắt đầu cuộc gọi.';
}

export function peerLabelFromStringeeUserId(userId: string): string {
  const m = /^staff_(\d+)$/.exec(userId.trim());
  return m ? `Staff #${m[1]}` : userId || 'Người gọi';
}
