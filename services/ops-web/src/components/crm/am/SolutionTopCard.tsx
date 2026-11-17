'use client';

import { useEffect, useState } from 'react';
import {
  estimateSolutionAiPercent,
  resolveSolutionAiCardState,
  type SolutionDeskActivity,
} from '@/lib/crm/solution-activity';
import { formatAttachmentMeta, formatFileSize } from '@/lib/crm/solution-file-display';
import { formatSolutionAiTime } from '@/lib/crm/solution-ai-draft-display';
import { openOrDownloadSolutionFile } from '@/lib/crm/solution-file-actions';
import type { SolutionAttachment } from '@/lib/crm/solution-file-display';

function Bar({ percent, testId }: { percent: number; testId: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className="ahd-sol-bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      data-testid={testId}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Step 3 "Chờ Solutions": top card in the middle column showing the AI Solution document
 * (ĐANG TẠO x% → AI Solution) and uploaded Solution files (with upload %).
 */
export function SolutionTopCard({
  activity,
  canRetry,
  customerName = '',
  leadCode = '',
  hideSettled = false,
  onOpenAi,
  onRetryAi,
  token = '',
  leadId = 0,
  onDeleteFile,
  onSaveSections,
  onExportProposal,
}: {
  activity: SolutionDeskActivity | null;
  canRetry: boolean;
  customerName?: string;
  leadCode?: string;
  /** File Solution tab is open: only show live progress (AI ĐANG TẠO / LỖI, upload %), not the settled rows. */
  hideSettled?: boolean;
  onOpenAi: () => void;
  onRetryAi: () => void;
  token?: string;
  leadId?: number;
  onDeleteFile?: (file: SolutionAttachment) => void;
  onSaveSections?: (sections: Array<{ key: string; label: string; body: string }>) => Promise<void>;
  onExportProposal?: () => Promise<void> | void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSections, setEditorSections] = useState<Array<{ key: string; label: string; body: string }>>([]);
  const [editorBusy, setEditorBusy] = useState(false);
  const aiState = resolveSolutionAiCardState(activity, now);
  const running = aiState.kind === 'running';
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [running]);

  if (!activity) return null;
  const files = activity.files.filter((file) => String(file.name ?? '').trim());
  const upload = activity.upload;
  const uploading = upload.phase !== 'idle';
  // Reading the file reports 0–30%, then the real upload reports 0–100% → one 0–100% bar.
  const uploadPct =
    upload.phase === 'reading'
      ? Math.max(upload.percent ?? 0, 3)
      : 30 + Math.round((Math.max(0, Math.min(100, upload.percent ?? 0)) * 70) / 100);

  const empty = aiState.kind === 'none' && files.length === 0 && !uploading;
  if (hideSettled && !uploading && aiState.kind !== 'running' && aiState.kind !== 'failed') return null;

  return (
    <section className="ahd-card ahd-sol-top" data-testid="ahd-solution-top" aria-label="File Solution">
      <h3 className="ahd-card__title">File Solution</h3>
      {empty ? (
        <p className="ahd-sol-empty" data-testid="ahd-solution-top-empty">
          Chưa có file Solution — bấm <strong>AI tạo Solution</strong> hoặc <strong>Chọn file</strong> ở khung bên phải.
        </p>
      ) : null}

      {aiState.kind === 'running' ? (() => {
        const pct = estimateSolutionAiPercent(now - aiState.startedAt, aiState.typicalMs);
        return (
          <div className="ahd-sol-row ahd-sol-row--ai" data-testid="ahd-solution-top-ai-running">
            <span className="ahd-sol-icon" aria-hidden>AI</span>
            <div className="ahd-sol-main">
              <div className="ahd-sol-name">
                AI Solution
                <span className="ahd-sol-chip ahd-sol-chip--busy">ĐANG TẠO {pct}%</span>
              </div>
              <Bar percent={pct} testId="ahd-solution-top-ai-progress" />
              <div className="ahd-sol-meta">
                {aiState.queuedAtAgent ? 'Đã gửi agent AI, đang chờ kết quả… ' : 'AI đang viết Solution… '}
                (ước tính theo thời gian chạy)
              </div>
            </div>
          </div>
        );
      })() : null}

      {aiState.kind === 'failed' ? (
        <div className="ahd-sol-row ahd-sol-row--ai ahd-sol-row--error" data-testid="ahd-solution-top-ai-failed">
          <span className="ahd-sol-icon" aria-hidden>AI</span>
          <div className="ahd-sol-main">
            <div className="ahd-sol-name">
              AI Solution
              <span className="ahd-sol-chip ahd-sol-chip--error">LỖI</span>
            </div>
            <div className="ahd-sol-meta ahd-sol-meta--error" role="alert">{aiState.error}</div>
          </div>
          {canRetry ? (
            <div className="ahd-sol-actions">
              <button type="button" className="ahd-btn ahd-btn--ghost" data-testid="ahd-solution-top-ai-retry" onClick={onRetryAi}>
                Thử lại
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {aiState.kind === 'done' && !hideSettled ? (
        <>
        <div className="ahd-sol-row ahd-sol-row--ai" data-testid="ahd-solution-top-ai-done">
          <span className="ahd-sol-icon" aria-hidden>AI</span>
          <div className="ahd-sol-main">
            <div className="ahd-sol-name">
              {aiState.draft.title || 'AI Solution'}
              <span className="ahd-sol-chip ahd-sol-chip--ok">AI Solution · 100%</span>
            </div>
            <div className="ahd-sol-meta">
              {aiState.draft.badge}
              {aiState.draft.requestedAt ? ` · ${formatSolutionAiTime(aiState.draft.requestedAt)}` : ''}
            </div>
            {aiState.draft.warnings?.length ? (
              <p className="ahd-sol-meta ahd-sol-meta--error" data-testid="ahd-solution-top-ai-warning">
                Thiếu dữ liệu, bản nháp vẫn được tạo với phần đánh dấu: {aiState.draft.warnings.join(', ')}.
              </p>
            ) : null}
          </div>
          <div className="ahd-sol-actions">
            <button
              type="button"
              className="ahd-btn ahd-btn--ghost"
              data-testid="ahd-solution-top-ai-open"
              onClick={() => {
                onOpenAi();
                setEditorSections(aiState.draft.sections.map((row) => ({ ...row })));
                setEditorOpen(true);
              }}
            >
              Mở / Sửa
            </button>
            <button
              type="button"
              className="ahd-btn ahd-btn--primary"
              data-testid="ahd-solution-top-ai-download"
              onClick={() => void onExportProposal?.()}
            >
              Tải
            </button>
          </div>
        </div>
        {editorOpen ? (
          <div className="ahd-sol-editor" data-testid="ahd-solution-top-ai-editor">
            {editorSections.map((section) => (
              <label key={section.key} className="ahd-sol-editor__field">
                <span>{section.label}</span>
                <textarea
                  rows={5}
                  value={section.body}
                  disabled={editorBusy}
                  onChange={(event) => {
                    const value = event.target.value;
                    setEditorSections((current) =>
                      current.map((row) => (row.key === section.key ? { ...row, body: value } : row)),
                    );
                  }}
                />
              </label>
            ))}
            <div className="ahd-sol-editor__actions">
              <button
                type="button"
                className="ahd-btn ahd-btn--primary"
                disabled={editorBusy}
                onClick={() => {
                  if (!onSaveSections) {
                    setEditorOpen(false);
                    return;
                  }
                  setEditorBusy(true);
                  void onSaveSections(editorSections)
                    .then(() => setEditorOpen(false))
                    .finally(() => setEditorBusy(false));
                }}
              >
                Lưu
              </button>
              <button
                type="button"
                className="ahd-btn ahd-btn--ghost"
                disabled={editorBusy}
                onClick={() => setEditorOpen(false)}
              >
                Hủy
              </button>
            </div>
          </div>
        ) : null}
        </>
      ) : null}

      {uploading ? (
        <div className="ahd-sol-row" data-testid="ahd-solution-top-uploading">
          <span className="ahd-sol-icon" aria-hidden>↑</span>
          <div className="ahd-sol-main">
            <div className="ahd-sol-name">
              {upload.name || 'File Solution'}
              <span className="ahd-sol-chip ahd-sol-chip--busy">
                {upload.phase === 'reading' ? 'ĐANG ĐỌC' : 'ĐANG TẢI'} {Math.round(uploadPct)}%
              </span>
            </div>
            <Bar percent={uploadPct} testId="ahd-solution-top-upload-progress" />
            {upload.size ? <div className="ahd-sol-meta">{formatFileSize(upload.size)}</div> : null}
          </div>
        </div>
      ) : null}

      {(hideSettled ? [] : files).map((file) => (
        <div className="ahd-sol-row" key={file.id} data-testid="ahd-solution-top-file">
          <span className="ahd-sol-icon" aria-hidden>FILE</span>
          <div className="ahd-sol-main">
            <div className="ahd-sol-name" title={file.name}>{file.name}</div>
            <div className="ahd-sol-meta">{formatAttachmentMeta(file)}</div>
          </div>
          <div className="ahd-sol-actions">
            <button
              type="button"
              className="ahd-btn ahd-btn--ghost"
              onClick={() => void openOrDownloadSolutionFile(token, leadId, file, 'open')}
            >
              Mở
            </button>
            <button
              type="button"
              className="ahd-btn ahd-btn--ghost"
              onClick={() => void openOrDownloadSolutionFile(token, leadId, file, 'download')}
            >
              Tải về
            </button>
            {onDeleteFile ? (
              <button
                type="button"
                className="ahd-btn ahd-btn--ghost"
                onClick={() => {
                  if (window.confirm(`Xóa file "${file.name}"?`)) onDeleteFile(file);
                }}
              >
                Xóa
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  );
}