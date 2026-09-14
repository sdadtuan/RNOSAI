import { mapStringeeSignalingCode, type StringeeUxPhase } from '@/lib/stringee-signaling.util';
import { startLocalRingback, type RingbackHandle } from '@/lib/csd-chat-call-ringback.util';

const STRINGEE_SDK_URL = 'https://cdn.stringee.com/sdk/web/latest/stringee-web-sdk.min.js';

declare global {
  interface Window {
    StringeeClient?: new () => StringeeClientInstance;
    StringeeCall?: new (
      client: StringeeClientInstance,
      fromNumber: string,
      toNumber: string,
      isVideoCall?: boolean,
    ) => StringeeCallInstance;
    StringeeUtil?: { isWebRTCSupported?: () => boolean };
  }
}

interface StringeeClientInstance {
  connect(accessToken: string): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  disconnect?: () => void;
}

interface StringeeCallInstance {
  fromNumber?: string;
  toNumber?: string;
  isVideoCall?: boolean;
  makeCall(callback: (res: { r: number; message?: string }) => void): void;
  answer(callback?: (res: { r: number; message?: string }) => void): void;
  reject(callback?: (res: { r: number; message?: string }) => void): void;
  ringing(callback?: (res: { r: number; message?: string }) => void): void;
  hangup(callback?: () => void): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
}

export type StringeeCallSession = {
  hangup: () => void;
  localMediaEl: HTMLMediaElement | null;
  remoteMediaEl: HTMLMediaElement | null;
};

export type StringeeIncomingCall = {
  fromUserId: string;
  isVideoCall: boolean;
  answer: (onPhase?: (phase: StringeeUxPhase) => void) => Promise<StringeeCallSession>;
  reject: () => void;
};

export type StringeePresenceSession = {
  disconnect: () => void;
  /** Outbound call on the same authenticated client (required — one user = one socket). */
  makeOutboundCall: (input: {
    fromUserId: string;
    toUserId: string;
    isVideoCall?: boolean;
    onPhase?: (phase: StringeeUxPhase) => void;
  }) => Promise<StringeeCallSession>;
};

let sdkPromise: Promise<void> | null = null;

export function loadStringeeWebSdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('stringee_browser_only'));
  }
  if (window.StringeeClient && window.StringeeCall) {
    return Promise.resolve();
  }
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${STRINGEE_SDK_URL}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('stringee_sdk_load_failed')));
        return;
      }
      const script = document.createElement('script');
      script.src = STRINGEE_SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('stringee_sdk_load_failed'));
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

function ensureMediaElements(isVideo: boolean): {
  local: HTMLMediaElement;
  remote: HTMLMediaElement;
  cleanup: () => void;
} {
  const wrap = document.createElement('div');
  wrap.setAttribute('data-testid', 'stringee-media-mount');
  wrap.style.cssText = isVideo
    ? 'position:fixed;right:12px;bottom:12px;z-index:9999;display:flex;gap:8px;pointer-events:none'
    : 'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none';

  const mk = (kind: 'local' | 'remote') => {
    const el = document.createElement(isVideo ? 'video' : 'audio') as HTMLMediaElement;
    el.autoplay = true;
    el.setAttribute('playsinline', 'true');
    el.setAttribute('data-stringee-media', kind);
    if (kind === 'local' && isVideo) {
      (el as HTMLVideoElement).muted = true;
      el.style.cssText = 'width:120px;height:90px;background:#0f172a;border-radius:8px;object-fit:cover';
    } else if (isVideo) {
      el.style.cssText = 'width:240px;height:180px;background:#0f172a;border-radius:8px;object-fit:cover';
    }
    wrap.appendChild(el);
    return el;
  };

  const local = mk('local');
  const remote = mk('remote');
  document.body.appendChild(wrap);

  return {
    local,
    remote,
    cleanup: () => {
      try {
        local.srcObject = null;
        remote.srcObject = null;
      } catch {
        /* noop */
      }
      wrap.remove();
    },
  };
}

function wireCallMedia(
  call: StringeeCallInstance,
  isVideo: boolean,
  onPhase: (phase: StringeeUxPhase) => void,
  opts?: { playRingback?: boolean },
): StringeeCallSession {
  const media = ensureMediaElements(isVideo);
  let ringback: RingbackHandle | null = null;

  const stopRingback = () => {
    ringback?.stop();
    ringback = null;
  };

  if (opts?.playRingback) {
    ringback = startLocalRingback();
  }

  call.on('addlocalstream', (stream: unknown) => {
    media.local.srcObject = null;
    media.local.srcObject = stream as MediaStream;
  });
  call.on('addremotestream', (stream: unknown) => {
    media.remote.srcObject = null;
    media.remote.srcObject = stream as MediaStream;
    void media.remote.play?.().catch(() => undefined);
  });
  call.on('signalingstate', (state: unknown) => {
    const code = Number((state as { code?: number })?.code);
    const phase = mapStringeeSignalingCode(code);
    if (!phase) return;
    if (phase === 'in_call' || phase === 'ended' || phase === 'busy') {
      stopRingback();
    }
    onPhase(phase);
  });
  call.on('ended', () => {
    stopRingback();
    onPhase('ended');
  });

  return {
    localMediaEl: media.local,
    remoteMediaEl: media.remote,
    hangup: () => {
      stopRingback();
      try {
        call.hangup();
      } finally {
        media.cleanup();
      }
    },
  };
}

async function connectClient(accessToken: string): Promise<StringeeClientInstance> {
  await loadStringeeWebSdk();
  const Client = window.StringeeClient;
  if (!Client) throw new Error('stringee_sdk_unavailable');
  if (window.StringeeUtil?.isWebRTCSupported && !window.StringeeUtil.isWebRTCSupported()) {
    throw new Error('webrtc_unsupported');
  }

  const client = new Client();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('stringee_connect_timeout')), 8000);
    client.on('authen', (res: unknown) => {
      const payload = res as { r?: number; message?: string };
      clearTimeout(timer);
      if (payload.r === 0) resolve();
      else reject(new Error(payload.message ?? 'stringee_authen_failed'));
    });
    client.connect(accessToken);
  });
  return client;
}

async function placeOutboundOnClient(
  client: StringeeClientInstance,
  input: {
    fromUserId: string;
    toUserId: string;
    isVideoCall?: boolean;
    onPhase?: (phase: StringeeUxPhase) => void;
    onSignal?: (event: string) => void;
    disconnectClientOnHangup?: boolean;
  },
): Promise<StringeeCallSession> {
  const Call = window.StringeeCall;
  if (!Call) throw new Error('stringee_sdk_unavailable');

  const isVideo = Boolean(input.isVideoCall);
  const call = new Call(client, input.fromUserId, input.toUserId, isVideo);

  const session = wireCallMedia(
    call,
    isVideo,
    (phase) => {
      input.onPhase?.(phase);
      if (phase === 'ringing') input.onSignal?.('ringing');
      if (phase === 'in_call') input.onSignal?.('answered');
      if (phase === 'ended' || phase === 'busy') input.onSignal?.('ended');
    },
    { playRingback: true },
  );

  await new Promise<void>((resolve, reject) => {
    call.makeCall((res) => {
      if (res.r === 0) resolve();
      else reject(new Error(res.message ?? 'stringee_make_call_failed'));
    });
  });

  // Local ringback immediately — Stringee RINGING only fires after callee.ringing().
  input.onPhase?.('ringing');
  input.onSignal?.('ringing');

  const baseHangup = session.hangup;
  return {
    ...session,
    hangup: () => {
      baseHangup();
      if (input.disconnectClientOnHangup) client.disconnect?.();
    },
  };
}

/** Standalone outbound (B2B softphone). CSD prefers presence.makeOutboundCall. */
export async function startStringeeWebCall(input: {
  accessToken: string;
  fromUserId: string;
  toUserId: string;
  isVideoCall?: boolean;
  onSignal?: (event: string) => void;
  onPhase?: (phase: StringeeUxPhase) => void;
}): Promise<StringeeCallSession> {
  const client = await connectClient(input.accessToken);
  return placeOutboundOnClient(client, {
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    isVideoCall: input.isVideoCall,
    onPhase: input.onPhase,
    onSignal: input.onSignal,
    disconnectClientOnHangup: true,
  });
}

export async function connectStringeePresence(input: {
  accessToken: string;
  onIncoming: (incoming: StringeeIncomingCall) => void;
}): Promise<StringeePresenceSession> {
  const client = await connectClient(input.accessToken);

  client.on('incomingcall', (raw: unknown) => {
    const call = raw as StringeeCallInstance;
    try {
      call.ringing?.(() => undefined);
    } catch {
      /* best-effort ring signal to caller */
    }

    const fromUserId = String(call.fromNumber ?? '');
    const isVideoCall = Boolean(call.isVideoCall);

    input.onIncoming({
      fromUserId,
      isVideoCall,
      reject: () => {
        try {
          call.reject();
        } catch {
          try {
            call.hangup();
          } catch {
            /* noop */
          }
        }
      },
      answer: async (onPhase) => {
        const session = wireCallMedia(
          call,
          isVideoCall,
          (phase) => {
            onPhase?.(phase);
          },
          { playRingback: false },
        );
        await new Promise<void>((resolve, reject) => {
          call.answer((res) => {
            if (!res || res.r === 0) resolve();
            else reject(new Error(res.message ?? 'stringee_answer_failed'));
          });
        });
        return session;
      },
    });
  });

  return {
    disconnect: () => {
      client.disconnect?.();
    },
    makeOutboundCall: (opts) =>
      placeOutboundOnClient(client, {
        fromUserId: opts.fromUserId,
        toUserId: opts.toUserId,
        isVideoCall: opts.isVideoCall,
        onPhase: opts.onPhase,
        disconnectClientOnHangup: false,
      }),
  };
}

export async function placeStringeeWebCall(input: {
  accessToken: string;
  fromNumber: string;
  toNumber: string;
}): Promise<void> {
  const session = await startStringeeWebCall({
    accessToken: input.accessToken,
    fromUserId: input.fromNumber,
    toUserId: input.toNumber,
    isVideoCall: false,
  });
  void session;
}
