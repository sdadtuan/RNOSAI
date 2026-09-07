export const CP_OVERLAY_MAX = 42;
export const CP_UNDO_LIMIT = 20;
export const CP_TIMELINE_SAVE_DEBOUNCE_MS = 350;

export const CP_TIMELINE_TRACKS = [
  { id: 'scene', label: 'Scene' },
  { id: 'vo', label: 'VO' },
  { id: 'music', label: 'Music' },
  { id: 'caption', label: 'Caption' },
] as const;

export type CpTimelineTrackId = (typeof CP_TIMELINE_TRACKS)[number]['id'];

export type CpScene = {
  draft_id?: string;
  idx: number;
  title?: string | null;
  t_start?: number | null;
  t_end?: number | null;
  visual?: string | null;
  vo?: string | null;
  overlay?: string | null;
  locked?: boolean;
  qc?: string | null;
};

export type CpTimelineMusic = {
  source?: string | null;
  t_start?: number | null;
  t_end?: number | null;
  volume?: number | null;
};

export type CpTimelineSnapshot = {
  scenes: CpScene[];
  music: CpTimelineMusic | null;
};

export function clipOverlay(value: string, max = CP_OVERLAY_MAX): string {
  return value.slice(0, max);
}

export function durationSec(
  start: number | null | undefined,
  end: number | null | undefined,
): number | null {
  if (start == null || end == null) return null;
  const duration = Number(end) - Number(start);
  return Number.isFinite(duration) ? duration : null;
}

export function applySceneRegenerate(
  scene: CpScene,
  generated: { visual: string; vo: string; overlay: string },
): CpScene {
  if (scene.locked) return scene;
  return { ...scene, ...generated };
}

export function reindexScenes(scenes: CpScene[]): CpScene[] {
  return scenes.map((scene, idx) => ({ ...scene, idx }));
}

export function createUndoStack<T>(limit = CP_UNDO_LIMIT) {
  let past: T[] = [];
  let future: T[] = [];
  return {
    push(snapshot: T) {
      past = [...past, snapshot].slice(-limit);
      future = [];
    },
    undo(current: T): T | null {
      if (!past.length) return null;
      const previous = past[past.length - 1];
      past = past.slice(0, -1);
      future = [current, ...future].slice(0, limit);
      return previous;
    },
    redo(current: T): T | null {
      if (!future.length) return null;
      const next = future[0];
      future = future.slice(1);
      past = [...past, current].slice(-limit);
      return next;
    },
    size() {
      return past.length;
    },
    canUndo() {
      return past.length > 0;
    },
    canRedo() {
      return future.length > 0;
    },
  };
}

export function createDebouncedSequencedSave<T, R>(options: {
  write: (value: T) => Promise<R>;
  apply?: (result: R, value: T) => void;
  onError?: (error: unknown, value: T) => void;
  delayMs?: number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}) {
  const delayMs = options.delayMs ?? CP_TIMELINE_SAVE_DEBOUNCE_MS;
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;
  let pending: T | undefined;

  function clearTimer() {
    if (timer == null) return;
    clearTimeoutFn(timer);
    timer = null;
  }

  function startWrite(value: T) {
    const current = seq;
    void options.write(value).then(
      (result) => {
        if (current !== seq) return;
        options.apply?.(result, value);
      },
      (error: unknown) => {
        if (current !== seq) return;
        options.onError?.(error, value);
      },
    );
  }

  return {
    schedule(value: T) {
      pending = value;
      seq += 1;
      clearTimer();
      const scheduled = seq;
      timer = setTimeoutFn(() => {
        timer = null;
        if (scheduled !== seq) return;
        const next = pending;
        pending = undefined;
        if (next !== undefined) startWrite(next);
      }, delayMs);
    },
    flush(value?: T) {
      const next = value !== undefined ? value : pending;
      pending = undefined;
      seq += 1;
      clearTimer();
      if (next !== undefined) startWrite(next);
    },
    cancel() {
      pending = undefined;
      seq += 1;
      clearTimer();
    },
    seq() {
      return seq;
    },
  };
}
