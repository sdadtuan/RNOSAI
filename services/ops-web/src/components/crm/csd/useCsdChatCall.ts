'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CsdChatCallMode } from '@/lib/crm/csd-api';
import {
  CSD_CHAT_CALL_IDLE,
  csdChatCallErrorMessage,
  startCsdChatDirectCall,
  type CsdChatCallState,
} from '@/lib/crm/csd-chat-call.util';
import type { StringeeCallSession } from '@/lib/stringee-web.util';

export function useCsdChatCall(token: string) {
  const [state, setState] = useState<CsdChatCallState>(CSD_CHAT_CALL_IDLE);
  const sessionRef = useRef<StringeeCallSession | null>(null);
  const busyRef = useRef(false);

  const hangup = useCallback(() => {
    sessionRef.current?.hangup();
    sessionRef.current = null;
    busyRef.current = false;
    setState(CSD_CHAT_CALL_IDLE);
  }, []);

  useEffect(() => () => hangup(), [hangup]);

  const startCall = useCallback(
    async (conversationId: string, mode: CsdChatCallMode) => {
      if (!conversationId || busyRef.current) return;
      busyRef.current = true;
      setState({ phase: 'connecting', mode, peerName: '', error: '' });
      try {
        const session = await startCsdChatDirectCall({
          token,
          conversationId,
          mode,
          onPhase: (phase) => {
            setState((prev) => ({ ...prev, phase }));
          },
          onPeerName: (peerName) => {
            setState((prev) => ({ ...prev, peerName }));
          },
        });
        sessionRef.current = session;
        setState((prev) => ({ ...prev, phase: 'in_call' }));
      } catch (err) {
        busyRef.current = false;
        setState({
          phase: 'error',
          mode,
          peerName: '',
          error: csdChatCallErrorMessage(err),
        });
      }
    },
    [token],
  );

  return { callState: state, startCall, hangup, callBusy: state.phase === 'connecting' || state.phase === 'ringing' || state.phase === 'in_call' };
}
