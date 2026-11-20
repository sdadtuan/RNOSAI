'use client';

import { useEffect, useRef, useState } from 'react';
import {
  estimateSolutionAiPercent,
  resolveSolutionAiCardState,
  type SolutionDeskActivity,
} from '@/lib/crm/solution-activity';
import { formatAttachmentMeta, formatFileSize } from '@/lib/crm/solution-file-display';
import { openOrDownloadSolutionFile } from '@/lib/crm/solution-file-actions';
import type { SolutionAttachment } from '@/lib/crm/solution-file-display';
import { SolutionAiDraftBody } from '@/components/crm/SolutionAiDocument';

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
 * once (ĐANG TẠO x% → editable AI Solution) and uploaded Solution files (with upload %).
 */
export function SolutionTopCard({
  activity,
  canRetry,
  customerName = '',
  contactName = '',
  leadCode = '',
  hideSettled = false,
  onRetryAi,
  token = '',
  leadId = 0,
  onDeleteFile,
  onSaveSections,
}: {
  activity: SolutionDeskActivity | null;
  canRetry: boolean;
  customerName?: string;
  contactName?: string;
  leadCode?: string;
  /** File Solution tab is open: only show live progress (AI ĐANG TẠO / LỖI, upload %), not the settled rows. */
  hideSettled?: boolean;
  onRetryAi: () => void;
  token?: string;
  leadId?: number;
  onDeleteFile?: (file: SolutionAttachment) => void;
  onSaveSections?: (sections: Array<{ key: string; label: string; body: string }>) => Promise<void>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [editorBusy, setEditorBusy] = useState(false);
  const sectionsRef = useRef<Array<{ key: string; label: string; body: string }>>([]);
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
        <div data-testid="ahd-solution-top-ai-done">
          {aiState.draft.warnings?.length ? (
            <p className="ahd-sol-meta ahd-sol-meta--error" data-testid="ahd-solution-top-ai-warning">
              Thiếu dữ liệu, bản nháp vẫn được tạo với phần đánh dấu: {aiState.draft.warnings.join(', ')}.
            </p>
          ) : null}
          <SolutionAiDraftBody
            title={aiState.draft.title}
            badge={aiState.draft.badge}
            sections={aiState.draft.sections}
            canEdit={Boolean(onSaveSections)}
            busy={editorBusy}
            companyName={customerName}
            contactName={contactName}
            leadCode={leadCode}
            createdAt={aiState.draft.requestedAt}
            onSectionChange={(key, body) => {
              const base = sectionsRef.current.length ? sectionsRef.current : aiState.draft.sections.map((row) => ({ ...row }));
              sectionsRef.current = base.map((row) => (row.key === key ? { ...row, body } : row));
            }}
            onSave={() => {
              if (!onSaveSections) return;
              const sections = sectionsRef.current.length ? sectionsRef.current : aiState.draft.sections;
              setEditorBusy(true);
              void onSaveSections(sections).finally(() => setEditorBusy(false));
            }}
          />
        </div>
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
