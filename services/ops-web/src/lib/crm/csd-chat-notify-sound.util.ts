/** Web Audio tones for CSD chat alerts (tab still alive — no push). */

export type CsdChatRingHandle = {
  stop: () => void;
};

let activeIncomingRing: CsdChatRingHandle | null = null;

function resolveAudioContextCtor(): (typeof AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function playBurstTone(input: {
  frequency: number;
  durationMs: number;
  gain?: number;
}): void {
  const Ctx = resolveAudioContextCtor();
  if (!Ctx) return;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = input.gain ?? 0.22;
  master.connect(ctx.destination);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = input.frequency;
  osc.connect(master);
  void ctx.resume().then(() => {
    osc.start();
    window.setTimeout(() => {
      try {
        osc.stop();
      } catch {
        /* noop */
      }
      void ctx.close().catch(() => undefined);
    }, input.durationMs);
  });
}

/** One-shot “ting” for new chat messages. */
export function playCsdChatMessageTone(): void {
  playBurstTone({ frequency: 880, durationMs: 160, gain: 0.2 });
}

/**
 * Looping incoming-call ring (callee). Separate from outbound ringback.
 * Only one active ring at a time.
 */
export function startCsdChatIncomingCallRing(): CsdChatRingHandle {
  stopCsdChatIncomingCallRing();

  const Ctx = resolveAudioContextCtor();
  if (!Ctx) {
    const noop = { stop: () => undefined };
    activeIncomingRing = noop;
    return noop;
  }

  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.2;
  master.connect(ctx.destination);

  let stopped = false;
  let osc: OscillatorNode | null = null;
  let cadenceTimer: ReturnType<typeof setTimeout> | null = null;

  const clearCadence = () => {
    if (cadenceTimer) {
      clearTimeout(cadenceTimer);
      cadenceTimer = null;
    }
  };

  const stopTone = () => {
    if (!osc) return;
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
    try {
      osc.disconnect();
    } catch {
      /* noop */
    }
    osc = null;
  };

  const playBurst = () => {
    if (stopped) return;
    stopTone();
    const next = ctx.createOscillator();
    const gain = ctx.createGain();
    next.type = 'sine';
    next.frequency.value = 480;
    gain.gain.value = 1;
    next.connect(gain);
    gain.connect(master);
    next.start();
    osc = next;
    cadenceTimer = setTimeout(() => {
      stopTone();
      if (stopped) return;
      cadenceTimer = setTimeout(playBurst, 1800);
    }, 900);
  };

  void ctx.resume().then(() => {
    if (!stopped) playBurst();
  });

  const handle: CsdChatRingHandle = {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearCadence();
      stopTone();
      void ctx.close().catch(() => undefined);
      if (activeIncomingRing === handle) activeIncomingRing = null;
    },
  };
  activeIncomingRing = handle;
  return handle;
}

export function stopCsdChatIncomingCallRing(): void {
  activeIncomingRing?.stop();
  activeIncomingRing = null;
}
