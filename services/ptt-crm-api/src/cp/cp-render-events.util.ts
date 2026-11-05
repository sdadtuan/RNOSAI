export const CP_RENDER_EVENT_POLL_MS = 5_000;

export type CpRenderEventType =
  | 'cp.video.render.queued'
  | 'cp.video.render.progressed'
  | 'cp.video.render.completed'
  | 'cp.video.render.failed';

export type CpRenderEventPayload = {
  type: CpRenderEventType;
  id: string | null;
  state: string | null;
  stage: string | null;
  progress: number | null;
};

export function isTerminalRenderState(state: string): boolean {
  return ['completed', 'failed', 'cancelled', 'expired'].includes(state);
}

export function renderEventType(state: string): CpRenderEventType {
  if (state === 'queued') return 'cp.video.render.queued';
  if (state === 'completed') return 'cp.video.render.completed';
  if (state === 'failed' || state === 'cancelled' || state === 'expired' || state === 'blocked') {
    return 'cp.video.render.failed';
  }
  return 'cp.video.render.progressed';
}

export function mapRenderJobEvent(job: Record<string, unknown>): CpRenderEventPayload {
  const progress = job.progress == null || job.progress === '' ? null : Number(job.progress);
  return {
    type: renderEventType(String(job.state ?? '')),
    id: job.id == null || job.id === '' ? null : String(job.id),
    state: job.state == null || job.state === '' ? null : String(job.state),
    stage: job.stage == null || job.stage === '' ? null : String(job.stage),
    progress: progress == null || !Number.isFinite(progress) ? null : progress,
  };
}
