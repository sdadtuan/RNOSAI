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
  makeCall(callback: (res: { r: number; message?: string }) => void): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  hangup(callback?: () => void): void;
}

export type StringeeCallSession = {
  hangup: () => void;
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

export async function startStringeeWebCall(input: {
  accessToken: string;
  fromUserId: string;
  toUserId: string;
  isVideoCall?: boolean;
  onSignal?: (event: string) => void;
}): Promise<StringeeCallSession> {
  await loadStringeeWebSdk();
  const Client = window.StringeeClient;
  const Call = window.StringeeCall;
  if (!Client || !Call) {
    throw new Error('stringee_sdk_unavailable');
  }
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
    client.connect(input.accessToken);
  });

  const call = new Call(client, input.fromUserId, input.toUserId, Boolean(input.isVideoCall));
  const notify = (event: string) => input.onSignal?.(event);
  for (const event of ['ringing', 'answered', 'ended']) {
    call.on(event, () => notify(event));
  }

  await new Promise<void>((resolve, reject) => {
    call.makeCall((res) => {
      if (res.r === 0) resolve();
      else reject(new Error(res.message ?? 'stringee_make_call_failed'));
    });
  });

  return {
    hangup: () => {
      try {
        call.hangup();
      } finally {
        client.disconnect?.();
      }
    },
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
