'use client';

import type { CsdChatCallState } from '@/lib/crm/csd-chat-call.util';

type CsdChatCallBarProps = {
  state: CsdChatCallState;
  onHangup: () => void;
  onDismissError: () => void;
};

function phaseLabel(state: CsdChatCallState): string {
  if (state.phase === 'connecting') return 'Đang kết nối…';
  if (state.phase === 'ringing') return 'Đang đổ chuông…';
  if (state.phase === 'in_call') {
    return state.mode === 'video' ? 'Đang gọi video' : 'Đang gọi thoại';
  }
  if (state.phase === 'ended') return 'Cuộc gọi đã kết thúc';
  return '';
}

export function CsdChatCallBar({ state, onHangup, onDismissError }: CsdChatCallBarProps) {
  if (state.phase === 'idle') return null;

  const peerLabel = state.peerName ? ` · ${state.peerName}` : '';

  if (state.phase === 'error') {
    return (
      <div className="csd-chat-call-bar csd-chat-call-bar--error" role="alert" data-testid="csd-chat-call-error">
        <span>{state.error}</span>
        <button type="button" className="btn btn-sm btn-secondary" onClick={onDismissError}>
          Đóng
        </button>
      </div>
    );
  }

  return (
    <div className="csd-chat-call-bar" data-testid="csd-chat-call-bar">
      <span>
        {phaseLabel(state)}
        {peerLabel}
      </span>
      <button type="button" className="btn btn-sm" onClick={onHangup} data-testid="csd-chat-call-hangup">
        Kết thúc
      </button>
    </div>
  );
}
