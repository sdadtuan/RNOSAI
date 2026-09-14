'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CsdChatCallMode } from '@/lib/crm/csd-api';
import {
  CSD_CHAT_CALL_IDLE,
  csdChatCallErrorMessage,
  peerLabelFromStringeeUserId,
  startCsdChatCallPresence,
  startCsdChatDirectCall,
  type CsdChatCallState,
} from '@/lib/crm/csd-chat-call.util';
import {
  csdChatCallNotifyTag,
  csdIncomingCallNotifyCopy,
  shouldAlertIncomingCsdCall,
} from '@/lib/crm/csd-chat-call-notify.util';
import {
  closeCsdChatDesktopNotifyByTag,
  notificationPermission,
  requestCsdChatNotifyPermission,
  showCsdChatDesktopNotify,
} from '@/lib/crm/csd-chat-notify-persist';
import { dispatchCsdNeedNotifyPermission } from '@/lib/crm/csd-chat-notify-permission.util';
import {
  startCsdChatIncomingCallRing,
  stopCsdChatIncomingCallRing,
} from '@/lib/crm/csd-chat-notify-sound.util';
import type {
  StringeeCallSession,
  StringeeIncomingCall,
  StringeePresenceSession,
} from '@/lib/stringee-web.util';

export function useCsdChatCall(token: string) {
  const [state, setState] = useState<CsdChatCallState>(CSD_CHAT_CALL_IDLE);
  const sessionRef = useRef<StringeeCallSession | null>(null);
  const presenceRef = useRef<StringeePresenceSession | null>(null);
  const incomingRef = useRef<StringeeIncomingCall | null>(null);
  const busyRef = useRef(false);
  const callNotifyTagRef = useRef<string | null>(null);

  const stopIncomingAlerts = useCallback(() => {
    stopCsdChatIncomingCallRing();
    if (callNotifyTagRef.current) {
      closeCsdChatDesktopNotifyByTag(callNotifyTagRef.current);
      callNotifyTagRef.current = null;
    }
  }, []);

  const clearActiveSession = useCallback(() => {
    stopIncomingAlerts();
    sessionRef.current?.hangup();
    sessionRef.current = null;
    incomingRef.current = null;
    busyRef.current = false;
  }, [stopIncomingAlerts]);

  const hangup = useCallback(() => {
    if (incomingRef.current && state.phase === 'incoming') {
      incomingRef.current.reject();
    }
    clearActiveSession();
    setState(CSD_CHAT_CALL_IDLE);
  }, [clearActiveSession, state.phase]);

  const dismissError = useCallback(() => {
    clearActiveSession();
    setState(CSD_CHAT_CALL_IDLE);
  }, [clearActiveSession]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const presence = await startCsdChatCallPresence({
          token,
          onIncoming: (incoming) => {
            if (busyRef.current) {
              incoming.reject();
              return;
            }
            busyRef.current = true;
            incomingRef.current = incoming;
            const peerName = peerLabelFromStringeeUserId(incoming.fromUserId);
            setState({
              phase: 'incoming',
              mode: incoming.isVideoCall ? 'video' : 'voice',
              peerName,
              error: '',
              direction: 'inbound',
            });

            void (async () => {
              let permission = notificationPermission();
              if (permission === 'default') {
                dispatchCsdNeedNotifyPermission();
                permission = await requestCsdChatNotifyPermission();
              }
              if (cancelled) return;
              startCsdChatIncomingCallRing();
              if (permission !== 'granted') {
                dispatchCsdNeedNotifyPermission();
                return;
              }
              if (
                !shouldAlertIncomingCsdCall({
                  permission,
                  alreadyBusy: false,
                })
              ) {
                return;
              }
              const copy = csdIncomingCallNotifyCopy({
                peerName,
                isVideo: incoming.isVideoCall,
              });
              const tagKey = incoming.fromUserId || 'unknown';
              callNotifyTagRef.current = csdChatCallNotifyTag(tagKey);
              showCsdChatDesktopNotify({
                title: copy.title,
                preview: copy.preview,
                conversationId: tagKey,
                kind: 'call',
                requireInteraction: true,
                onOpen: () => {
                  window.focus();
                },
              });
            })();
          },
        });
        if (cancelled) {
          presence?.disconnect();
          return;
        }
        presenceRef.current = presence;
      } catch {
        /* presence optional when Stringee off */
      }
    })();
    return () => {
      cancelled = true;
      clearActiveSession();
      presenceRef.current?.disconnect();
      presenceRef.current = null;
    };
  }, [token, clearActiveSession]);

  const startCall = useCallback(
    async (conversationId: string, mode: CsdChatCallMode) => {
      if (!conversationId || busyRef.current) return;
      busyRef.current = true;
      setState({
        phase: 'connecting',
        mode,
        peerName: '',
        error: '',
        direction: 'outbound',
      });
      try {
        const session = await startCsdChatDirectCall({
          token,
          conversationId,
          mode,
          presence: presenceRef.current,
          onPhase: (phase) => {
            if (phase === 'ended') {
              clearActiveSession();
              setState((prev) => ({ ...prev, phase: 'ended' }));
              window.setTimeout(() => setState(CSD_CHAT_CALL_IDLE), 1500);
              return;
            }
            setState((prev) => ({ ...prev, phase }));
          },
          onPeerName: (peerName) => {
            setState((prev) => ({ ...prev, peerName }));
          },
        });
        sessionRef.current = session;
      } catch (err) {
        busyRef.current = false;
        sessionRef.current = null;
        setState({
          phase: 'error',
          mode,
          peerName: '',
          error: csdChatCallErrorMessage(err),
          direction: 'outbound',
        });
      }
    },
    [token, clearActiveSession],
  );

  const answerIncoming = useCallback(async () => {
    const incoming = incomingRef.current;
    if (!incoming) return;
    stopIncomingAlerts();
    setState((prev) => ({ ...prev, phase: 'connecting' }));
    try {
      const session = await incoming.answer((phase) => {
        if (phase === 'ended' || phase === 'busy') {
          clearActiveSession();
          setState((prev) => ({ ...prev, phase: 'ended' }));
          window.setTimeout(() => setState(CSD_CHAT_CALL_IDLE), 1500);
          return;
        }
        if (phase === 'in_call') {
          setState((prev) => ({ ...prev, phase: 'in_call' }));
        }
      });
      sessionRef.current = session;
      incomingRef.current = null;
      setState((prev) => ({ ...prev, phase: 'in_call', direction: 'inbound' }));
    } catch (err) {
      clearActiveSession();
      setState({
        phase: 'error',
        mode: incoming.isVideoCall ? 'video' : 'voice',
        peerName: peerLabelFromStringeeUserId(incoming.fromUserId),
        error: csdChatCallErrorMessage(err),
        direction: 'inbound',
      });
    }
  }, [clearActiveSession, stopIncomingAlerts]);

  const rejectIncoming = useCallback(() => {
    incomingRef.current?.reject();
    clearActiveSession();
    setState(CSD_CHAT_CALL_IDLE);
  }, [clearActiveSession]);

  const callBusy =
    state.phase === 'connecting' ||
    state.phase === 'ringing' ||
    state.phase === 'incoming' ||
    state.phase === 'in_call';

  return {
    callState: state,
    startCall,
    hangup,
    dismissError,
    answerIncoming,
    rejectIncoming,
    callBusy,
  };
}
