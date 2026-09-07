'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  CP_RENDER_POLL_MS,
  cancelCpRender,
  cpRenderEventsUrl,
  formatCpApiError,
  getCpRender,
  listCpRenders,
  retryCpRender,
  type CpRenderJob,
  type CpScope,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

export const CP_RENDER_TRACE_STAGES = [
  'Validation+reserve',
  'Moderation+rights',
  'Script/scene',
  'TTS',
  'Mix',
  'Composite',
  'Encode',
  'QC',
  'CDN',
] as const;

function scopeFrom(value?: string): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function reasonText(job: CpRenderJob): string {
  const source = job.error_json;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return job.error ?? '';
  const body = source as Record<string, unknown>;
  const reasons = Array.isArray(body.reasons)
    ? body.reasons.filter((reason): reason is string => typeof reason === 'string')
    : [];
  const code = typeof body.error === 'string' ? body.error : job.error ?? '';
  return reasons.length ? `${code || 'render_blocked'}: ${reasons.join(', ')}` : code;
}

function canRetry(state: string): boolean {
  return ['failed', 'cancelled', 'expired', 'blocked'].includes(state);
}

function canCancel(state: string): boolean {
  return !['completed', 'cancelled', 'expired', 'failed', 'blocked'].includes(state);
}

export function CpRenderOps({ scope: scopeValue }: { scope?: string }) {
  const scope = scopeFrom(scopeValue);
  const [jobs, setJobs] = useState<CpRenderJob[]>([]);
  const [selected, setSelected] = useState<CpRenderJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    if (!quiet) {
      setLoading(true);
      setError('');
    }
    try {
      const result = await listCpRenders(token, scope);
      setJobs(result.items);
      setSelected((current) => (
        result.items.find((job) => job.id === current?.id) ?? result.items[0] ?? null
      ));
    } catch (caught) {
      if (!quiet) {
        setJobs([]);
        setSelected(null);
        setError(formatCpApiError(caught, 'Không tải được render jobs'));
      }
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
    const pollTimer = window.setInterval(() => void load(true), CP_RENDER_POLL_MS);
    return () => window.clearInterval(pollTimer);
  }, [load]);

  useEffect(() => {
    if (!selected?.id) return;
    const token = getAccessToken();
    if (!token || typeof EventSource === 'undefined') return;
    let source: EventSource | null = null;
    try {
      source = new EventSource(cpRenderEventsUrl(token, selected.id, scope));
      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            id?: string;
            state?: string;
            stage?: string | null;
            progress?: number | null;
          };
          if (!payload.id) return;
          const jobId = payload.id;
          setSelected((current) => {
            if (!current || current.id !== jobId) return current;
            return {
              ...current,
              state: payload.state ?? current.state,
              stage: payload.stage ?? current.stage,
              progress: payload.progress ?? current.progress,
            };
          });
          setJobs((current) => current.map((job) => (
            job.id === payload.id
              ? {
                  ...job,
                  state: payload.state ?? job.state,
                  stage: payload.stage ?? job.stage,
                  progress: payload.progress ?? job.progress,
                }
              : job
          )));
        } catch {
          // keep poll fallback
        }
      };
      source.onerror = () => {
        source?.close();
        source = null;
      };
    } catch {
      source = null;
    }
    return () => source?.close();
  }, [scope, selected?.id]);

  async function selectJob(job: CpRenderJob) {
    const token = getAccessToken();
    if (!token) return;
    setSelected(job);
    try {
      setSelected(await getCpRender(token, job.id, scope));
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không tải được render job'));
    }
  }

  async function act(job: CpRenderJob, action: 'retry' | 'cancel') {
    const token = getAccessToken();
    if (!token) return;
    setActingId(job.id);
    setError('');
    try {
      if (action === 'retry') await retryCpRender(token, job.id, scope);
      else await cancelCpRender(token, job.id, scope);
      await load();
    } catch (caught) {
      setError(formatCpApiError(caught, `Không thể ${action} render`));
    } finally {
      setActingId('');
    }
  }

  return (
    <div className="cp-overview" aria-busy={loading}>
      {error ? <section className="cp-card cp-card--error"><p>{error}</p><button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button></section> : null}
      <section className="cp-card">
        <div className="cp-card__head"><h2>Render jobs</h2></div>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead><tr><th>Job</th><th>Parent</th><th>State</th><th>Stage</th><th>Progress</th><th>Provider</th><th>Estimate</th><th>Thao tác</th></tr></thead>
            <tbody>
              {jobs.length ? jobs.map((job) => (
                <tr key={job.id}>
                  <td><button className="cp-link" type="button" onClick={() => void selectJob(job)}>{job.id}</button></td>
                  <td>{dash(job.parent_job_id)}</td>
                  <td><span className={job.state === 'failed' || job.state === 'blocked' ? 'cp-pill cp-pill--danger' : 'cp-pill'}>{dash(job.state)}</span></td>
                  <td>{dash(job.stage)}</td>
                  <td>{job.progress == null ? dash(null) : `${job.progress}%`}</td>
                  <td>{dash(job.provider)}</td>
                  <td>{dash(job.estimate)}</td>
                  <td>
                    <div className="cp-filters">
                      <button className="cp-btn" type="button" disabled={!canRetry(job.state) || actingId === job.id} onClick={() => void act(job, 'retry')}>Retry</button>
                      <button className="cp-btn" type="button" disabled={!canCancel(job.state) || actingId === job.id} onClick={() => void act(job, 'cancel')}>Cancel</button>
                    </div>
                  </td>
                </tr>
              )) : <tr><td className="cp-empty" colSpan={8}>{loading ? 'Đang tải…' : dash(null)}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cp-card">
        <div className="cp-card__head"><h2>{selected ? `${selected.id} trace` : 'Job trace'}</h2></div>
        {selected ? (
          <>
            <ol className="cp-timeline">
              {CP_RENDER_TRACE_STAGES.map((stage) => <li key={stage}><b>{stage}</b></li>)}
            </ol>
            {['failed', 'blocked'].includes(selected.state) ? (
              <p className="cp-card--error">{reasonText(selected) || dash(null)}</p>
            ) : null}
          </>
        ) : <p className="cp-empty">{dash(null)}</p>}
      </section>
    </div>
  );
}
