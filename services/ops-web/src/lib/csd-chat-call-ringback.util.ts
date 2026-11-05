/** Local ringback while callee has not answered (Stringee does not play this for you). */

export type RingbackHandle = {
  stop: () => void;
};

export function startLocalRingback(): RingbackHandle {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return { stop: () => undefined };
  }

  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return { stop: () => undefined };

  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.18;
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
    next.frequency.value = 440;
    gain.gain.value = 1;
    next.connect(gain);
    gain.connect(master);
    next.start();
    osc = next;
    // classic ringback: ~1s tone, ~2s silence
    cadenceTimer = setTimeout(() => {
      stopTone();
      if (stopped) return;
      cadenceTimer = setTimeout(playBurst, 2000);
    }, 1000);
  };

  void ctx.resume().then(() => {
    if (!stopped) playBurst();
  });

  return {
    stop: () => {
      stopped = true;
      clearCadence();
      stopTone();
      void ctx.close().catch(() => undefined);
    },
  };
}
