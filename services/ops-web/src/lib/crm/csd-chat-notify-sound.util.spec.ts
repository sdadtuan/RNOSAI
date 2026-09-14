import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('csd-chat-notify-sound.util', () => {
  const created: Array<{ close: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn> }> = [];

  beforeEach(() => {
    created.length = 0;
    class FakeOscillator {
      type = 'sine';
      frequency = { value: 0 };
      connect = vi.fn();
      start = vi.fn();
      stop = vi.fn();
      disconnect = vi.fn();
    }
    class FakeGain {
      gain = { value: 0 };
      connect = vi.fn();
    }
    class FakeAudioContext {
      destination = {};
      createOscillator = vi.fn(() => new FakeOscillator());
      createGain = vi.fn(() => new FakeGain());
      resume = vi.fn(() => Promise.resolve());
      close = vi.fn(() => Promise.resolve());
      constructor() {
        created.push(this as never);
      }
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('window', globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('playCsdChatMessageTone creates an AudioContext', async () => {
    const { playCsdChatMessageTone } = await import('./csd-chat-notify-sound.util');
    playCsdChatMessageTone();
    expect(created.length).toBeGreaterThanOrEqual(1);
  });

  it('incoming call ring stop is idempotent', async () => {
    const { startCsdChatIncomingCallRing, stopCsdChatIncomingCallRing } = await import(
      './csd-chat-notify-sound.util'
    );
    const handle = startCsdChatIncomingCallRing();
    handle.stop();
    handle.stop();
    stopCsdChatIncomingCallRing();
    stopCsdChatIncomingCallRing();
    expect(created.length).toBeGreaterThanOrEqual(1);
  });
});
