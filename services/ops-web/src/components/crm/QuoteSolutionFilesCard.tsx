'use client';

import { useEffect, useState } from 'react';
import { fetchLeadPresalesMarketingPlan } from '@/lib/api';
import { formatSolutionAiTime, presentSolutionAiDraft, type SolutionAiDraftView } from '@/lib/crm/solution-ai-draft-display';
import {
  formatFileSize,
  attachmentByteSize,
  readSolutionAttachments,
  type SolutionAttachment,
} from '@/lib/crm/solution-file-display';
import { formatHistoryClock } from '@/lib/crm/lead-history';
import { downloadSolutionAiHtmlDocument } from '@/components/crm/SolutionAiDocument';

const DOC_ICON =
  'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6';

export function QuoteSolutionFilesCard({
  token,
  leadId,
  customerName,
  leadCode,
  onView,
}: {
  token: string;
  leadId: number;
  customerName?: string;
  leadCode?: string;
  onView: () => void;
}) {
  const [files, setFiles] = useState<SolutionAttachment[]>([]);
  const [aiDraft, setAiDraft] = useState<SolutionAiDraftView | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchLeadPresalesMarketingPlan(token, leadId)
      .then((out) => {
        if (cancelled) return;
        const plan = (out?.plan ?? null) as Record<string, unknown> | null;
        setFiles(readSolutionAttachments(plan));
        setAiDraft(presentSolutionAiDraft(plan));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, leadId]);

  const customer = (customerName || '').trim() || 'Khách hàng';
  const hasItems = Boolean(aiDraft) || files.length > 0;

  function downloadAi() {
    if (!aiDraft || aiDraft.status === 'pending') return;
    downloadSolutionAiHtmlDocument({
      customer,
      leadCode: leadCode || '',
      createdAt: formatSolutionAiTime(aiDraft.requestedAt),
      subtitle: aiDraft.title,
      sections: aiDraft.sections,
    });
  }

  return (
    <section className="ahd-card quote-solution-card" data-testid="quote-solution-card">
      <h3 className="ahd-card__title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d={DOC_ICON} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        File Solution
      </h3>
      {!loaded ? <p className="quote-solution-card__empty">Đang tải file…</p> : null}
      {loaded && !hasItems ? <p className="quote-solution-card__empty">Chưa có file Solution.</p> : null}
      {aiDraft ? (
        <div className="quote-solution-card__row">
          <div className="quote-solution-card__copy">
            <div className="quote-solution-card__name" title={aiDraft.title || `Solution - ${customer} (AI)`}>
              {aiDraft.title && !/^bản nháp solution$/i.test(aiDraft.title.trim())
                ? aiDraft.title
                : `Solution - ${customer} (AI)`}
            </div>
            <div className="quote-solution-card__meta">
              <span className="quote-solution-card__badge">
                {aiDraft.status === 'pending' ? 'Đang chờ' : 'Bản AI'}
              </span>
              {formatSolutionAiTime(aiDraft.requestedAt) ? (
                <span>{formatSolutionAiTime(aiDraft.requestedAt)}</span>
              ) : null}
            </div>
          </div>
          <div className="quote-solution-card__actions">
            <button type="button" className="btn btn-sm btn-secondary" onClick={onView}>
              Xem
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={aiDraft.status === 'pending'}
              onClick={downloadAi}
            >
              Tải
            </button>
          </div>
        </div>
      ) : null}
      {files.map((file) => {
        const when = formatHistoryClock(file.uploaded_at);
        const size = formatFileSize(attachmentByteSize(file));
        return (
          <div key={file.id} className="quote-solution-card__row">
            <div className="quote-solution-card__copy">
              <div className="quote-solution-card__name" title={file.name}>
                {file.name}
              </div>
              <div className="quote-solution-card__meta">
                <span>{size}</span>
                {when ? <span>{when}</span> : null}
              </div>
            </div>
            <div className="quote-solution-card__actions">
              <button type="button" className="btn btn-sm btn-secondary" onClick={onView}>
                Xem
              </button>
              <a className="btn btn-sm btn-secondary" href={file.data_url} download={file.name}>
                Tải
              </a>
            </div>
          </div>
        );
      })}
    </section>
  );
}
