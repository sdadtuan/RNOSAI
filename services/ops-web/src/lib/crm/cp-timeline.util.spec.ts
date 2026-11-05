import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CP_OVERLAY_MAX,
  CP_TIMELINE_SAVE_DEBOUNCE_MS,
  CP_TIMELINE_TRACKS,
  CP_UNDO_LIMIT,
  applySceneRegenerate,
  clipOverlay,
  createDebouncedSequencedSave,
  createUndoStack,
  durationSec,
  type CpScene,
} from './cp-timeline.util';

const scene = (overrides: Partial<CpScene> = {}): CpScene => ({
  draft_id: 'draft-1',
  idx: 0,
  title: 'Hook',
  t_start: 0,
  t_end: 3,
  visual: 'wide shot',
  vo: 'xin chao',
  overlay: 'HELLO',
  locked: false,
  qc: null,
  ...overrides,
});

describe('CP timeline tracks and undo', () => {
  it('exposes only Scene VO Music Caption tracks', () => {
    expect(CP_TIMELINE_TRACKS.map((track) => track.id)).toEqual([
      'scene',
      'vo',
      'music',
      'caption',
    ]);
    expect(CP_TIMELINE_TRACKS.map((track) => track.label)).toEqual([
      'Scene',
      'VO',
      'Music',
      'Caption',
    ]);
  });

  it('keeps a client-side undo stack of 20', () => {
    const stack = createUndoStack<number>(CP_UNDO_LIMIT);
    for (let value = 0; value < 25; value += 1) {
      stack.push(value);
    }

    expect(stack.size()).toBe(20);
    expect(stack.undo(25)).toBe(24);
    expect(stack.undo(24)).toBe(23);
    expect(stack.redo(23)).toBe(24);
  });

  it('drops the oldest snapshot once the undo stack exceeds 20', () => {
    const stack = createUndoStack<number>();
    for (let value = 1; value <= 21; value += 1) {
      stack.push(value);
    }

    let current = 22;
    for (let step = 0; step < 20; step += 1) {
      const previous = stack.undo(current);
      expect(previous).not.toBeNull();
      current = previous as number;
    }
    expect(current).toBe(2);
    expect(stack.undo(current)).toBeNull();
  });
});

describe('locked regenerate helper', () => {
  it('does not change locked overlay vo or visual', () => {
    const locked = scene({
      locked: true,
      overlay: 'LOCKED OVERLAY',
      vo: 'locked vo',
      visual: 'locked visual',
    });

    expect(applySceneRegenerate(locked, {
      visual: 'new visual',
      vo: 'new vo',
      overlay: 'NEW OVERLAY',
    })).toEqual(locked);
  });

  it('applies generated copy when the scene is unlocked', () => {
    const unlocked = scene({ locked: false, overlay: 'OLD' });

    expect(applySceneRegenerate(unlocked, {
      visual: 'new visual',
      vo: 'new vo',
      overlay: 'NEW',
    })).toMatchObject({
      visual: 'new visual',
      vo: 'new vo',
      overlay: 'NEW',
    });
  });
});

describe('scene helpers', () => {
  it('clips overlay to the default 42 characters and dashes empty duration', () => {
    expect(CP_OVERLAY_MAX).toBe(42);
    expect(clipOverlay('x'.repeat(50))).toHaveLength(42);
    expect(durationSec(null, null)).toBeNull();
    expect(durationSec(0, 3)).toBe(3);
  });
});

describe('debounced sequenced timeline saves', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not write on every keystroke until the debounce elapses', async () => {
    vi.useFakeTimers();
    const write = vi.fn().mockResolvedValue('ok');
    const apply = vi.fn();
    const saver = createDebouncedSequencedSave({
      write,
      apply,
      delayMs: CP_TIMELINE_SAVE_DEBOUNCE_MS,
    });

    saver.schedule('a');
    saver.schedule('ab');
    saver.schedule('abc');
    expect(write).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(CP_TIMELINE_SAVE_DEBOUNCE_MS);

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('abc');
    expect(apply).toHaveBeenCalledWith('ok', 'abc');
  });

  it('ignores a stale write response after a newer seq is issued', async () => {
    vi.useFakeTimers();
    let resolveFirst!: (value: string) => void;
    const write = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = resolve;
      }))
      .mockResolvedValueOnce('second');
    const apply = vi.fn();
    const saver = createDebouncedSequencedSave({ write, apply, delayMs: 350 });

    saver.schedule('first');
    await vi.advanceTimersByTimeAsync(350);
    expect(write).toHaveBeenCalledTimes(1);

    saver.schedule('second');
    await vi.advanceTimersByTimeAsync(350);
    expect(write).toHaveBeenCalledTimes(2);

    resolveFirst('first');
    await Promise.resolve();
    await Promise.resolve();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith('second', 'second');
    expect(apply).not.toHaveBeenCalledWith('first', 'first');
  });
});
