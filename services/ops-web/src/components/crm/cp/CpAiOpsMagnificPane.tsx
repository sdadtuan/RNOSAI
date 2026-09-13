'use client';

import { useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  confirmMagnificJob,
  draftMagnificJob,
  extractJobAssetId,
  formatMagnificConfirmError,
  formatMagnificEstimate,
  getMagnificJob,
  magnificCompletionNotice,
  submitMagnificJob,
} from '@/lib/crm/cp-ai-ops-api';
import {
  MAGNIFIC_COMPOSER_STEPS,
  MAGNIFIC_HUMAN_ROUTE_COPY,
  magnificComposerEmptyCopy,
} from '@/lib/crm/cp-ai-ops-composer.util';
import {
  isMagnificComposerDisabled,
  isMagnificJobTerminal,
  isMagnificTransportEnabled,
  MAGNIFIC_JOB_POLL_INTERVAL_MS,
  MAGNIFIC_JOB_POLL_TIMEOUT_MS,
  MAGNIFIC_JOB_POLL_TIMEOUT_NOTICE,
  magnificPollTimedOut,
  magnificProviderFromTransport,
  type MagnificTransport,
} from '@/lib/crm/cp-ai-ops-panes.util';
import type { CpAiOpsFlags } from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

const PROGRESS_VI: Record<string, string> = {
  draft: 'Bản nháp',
  pending_confirm: 'Chờ xác nhận',
  queued: 'Đang xếp hàng',
  running: 'Đang chạy',
  processing: 'Đang chạy',
  qc: 'Kiểm tra chất lượng',
  completed: 'Hoàn tất',
  failed: 'Thất bại',
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatProgress(value: string | null | undefined): string {
  const key = String(value ?? '').trim();
  if (!key) return dash(null);
  return PROGRESS_VI[key] ?? key;
}

export function CpAiOpsMagnificPane({
  projectId,
  flags,
}: {
  projectId: string;
  flags: CpAiOpsFlags;
}) {
  const composerOff = isMagnificComposerDisabled(flags);
  const defaultTransport: MagnificTransport = flags.magnificRest
    ? 'api'
    : flags.magnificMcp
      ? 'mcp'
      : 'api';
  const [transport, setTransport] = useState<MagnificTransport>(defaultTransport);
  const [prompt, setPrompt] = useState('');
  const [jobId, setJobId] = useState('');
  const [estimate, setEstimate] = useState<{ credits: number | null; duration_sec: number | null } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState('');
  const [assetId, setAssetId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const estimateText = useMemo(
    () => (estimate ? formatMagnificEstimate(estimate) : dash(null)),
    [estimate],
  );

  async function pollJob(token: string, id: string) {
    const started = Date.now();
    while (true) {
      const job = await getMagnificJob(token, id);
      const state = String(job.state ?? job.status ?? '');
      setProgress(state);
      const found = extractJobAssetId(job);
      if (found) {
        setAssetId(found);
        setNotice(magnificCompletionNotice(job));
        return;
      }
      if (isMagnificJobTerminal(state)) {
        setNotice(magnificCompletionNotice(job));
        return;
      }
      const elapsed = Date.now() - started;
      if (magnificPollTimedOut(elapsed, MAGNIFIC_JOB_POLL_TIMEOUT_MS)) {
        setNotice(MAGNIFIC_JOB_POLL_TIMEOUT_NOTICE);
        return;
      }
      const remaining = MAGNIFIC_JOB_POLL_TIMEOUT_MS - elapsed;
      await sleep(Math.min(MAGNIFIC_JOB_POLL_INTERVAL_MS, Math.max(0, remaining)));
    }
  }

  async function run(action: string, work: (token: string) => Promise<void>) {
    const token = getAccessToken();
    if (!token) return;
    setBusy(action);
    setError('');
    try {
      await work(token);
    } catch (err) {
      setError(formatMagnificConfirmError(err));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="cp-ai-ops-composer" data-testid="cp-magnific-pane">
      <header className="cp-ai-ops-head">
        <h2>Magnific</h2>
        <p className="cp-muted">Chọn API hoặc MCP, xem ước tính, xác nhận rồi gửi.</p>
      </header>
      {error ? <p className="cp-card--error" data-testid="cp-magnific-error">{error}</p> : null}
      {notice ? <p className="cp-muted" data-testid="cp-magnific-notice">{notice}</p> : null}

      {composerOff ? (
        <p className="cp-empty" data-testid="cp-magnific-empty">{magnificComposerEmptyCopy(true)}</p>
      ) : null}

      <fieldset className="cp-ai-ops-fieldset" disabled={composerOff || busy !== ''}>
        <div className="cp-ai-ops-step" data-testid="cp-magnific-step-context">
          <h3 className="cp-ai-ops-step-title">{MAGNIFIC_COMPOSER_STEPS[0].label}</h3>
          <p className="cp-muted" data-testid="cp-magnific-human-route">{MAGNIFIC_HUMAN_ROUTE_COPY}</p>
          <div className="cp-ai-ops-radios" role="radiogroup" aria-label="Kết nối Magnific">
            <label className="cp-ai-ops-radio">
              <input
                type="radio"
                name="magnific-transport"
                value="api"
                checked={transport === 'api'}
                disabled={!isMagnificTransportEnabled(flags, 'api')}
                onChange={() => setTransport('api')}
                data-testid="cp-magnific-transport-api"
              />
              API
            </label>
            <label className="cp-ai-ops-radio">
              <input
                type="radio"
                name="magnific-transport"
                value="mcp"
                checked={transport === 'mcp'}
                disabled={!isMagnificTransportEnabled(flags, 'mcp')}
                onChange={() => setTransport('mcp')}
                data-testid="cp-magnific-transport-mcp"
              />
              MCP
            </label>
          </div>
        </div>

        <div className="cp-ai-ops-step" data-testid="cp-magnific-step-prompt">
          <h3 className="cp-ai-ops-step-title">{MAGNIFIC_COMPOSER_STEPS[1].label}</h3>
          <label className="cp-ai-ops-field">
            Prompt
            <textarea
              data-testid="cp-magnific-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
              placeholder="Mô tả output"
            />
          </label>
          <div className="cp-ai-ops-actions">
            <button
              className="cp-btn"
              type="button"
              data-testid="cp-magnific-draft"
              disabled={composerOff || busy !== ''}
              onClick={() => run('draft', async (token) => {
                const drafted = await draftMagnificJob(token, {
                  project_id: projectId,
                  provider: magnificProviderFromTransport(transport),
                  inputs: { prompt: prompt.trim(), capability: 'images_generate' },
                  idempotency_key: crypto.randomUUID(),
                });
                setJobId(drafted.job_id);
                setEstimate(drafted.estimate);
                setProgress(drafted.status);
                setAssetId('');
                setNotice('');
                setConfirmed(false);
              })}
            >
              Tạo bản nháp
            </button>
          </div>
        </div>

        <div className="cp-ai-ops-step" data-testid="cp-magnific-step-confirm">
          <h3 className="cp-ai-ops-step-title">{MAGNIFIC_COMPOSER_STEPS[2].label}</h3>
          <p className="cp-ai-ops-meta">
            Ước tính <span data-testid="cp-magnific-estimate">{estimateText}</span>
          </p>
          <label className="cp-check">
            <input
              type="checkbox"
              data-testid="cp-magnific-confirm"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Tôi xác nhận ước tính chi phí
          </label>
          <div className="cp-ai-ops-actions">
            <button
              className="cp-btn cp-btn--primary"
              type="button"
              data-testid="cp-magnific-submit"
              disabled={composerOff || busy !== '' || !jobId}
              onClick={() => run('submit', async (token) => {
                await confirmMagnificJob(token, jobId, confirmed);
                const submitted = await submitMagnificJob(token, jobId);
                setProgress(String(submitted.status ?? submitted.state ?? 'queued'));
                await pollJob(token, jobId);
              })}
            >
              Gửi
            </button>
          </div>
        </div>
      </fieldset>

      <p className="cp-ai-ops-meta">
        Tiến độ <span data-testid="cp-magnific-progress">{formatProgress(progress)}</span>
      </p>
      <p className="cp-ai-ops-meta">
        Asset <span data-testid="cp-magnific-asset">{dash(assetId || null)}</span>
      </p>
    </section>
  );
}
