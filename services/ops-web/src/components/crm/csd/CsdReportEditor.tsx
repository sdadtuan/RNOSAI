'use client';

import { useState } from 'react';
import type { CsdReportDetail } from '@/lib/crm/csd-api';

type CsdReportEditorProps = {
  report: CsdReportDetail;
  canWrite: boolean;
  onSaveSection?: (key: string, value: string) => Promise<void>;
  onSubmitReview?: () => Promise<void>;
  onApprove?: () => Promise<void>;
  onSend?: () => void;
};

const SECTION_LABELS: Record<string, string> = {
  executive_summary: 'Tóm tắt điều hành',
  work_completed: 'Công việc hoàn thành',
  risks: 'Rủi ro & chặn',
  next_period: 'Kế hoạch kỳ tới',
};

export function CsdReportEditor({
  report,
  canWrite,
  onSaveSection,
  onSubmitReview,
  onApprove,
  onSend,
}: CsdReportEditorProps) {
  const [activeSection, setActiveSection] = useState('executive_summary');
  const sections = report.sections_json ?? {};
  const keys = Object.keys(SECTION_LABELS);
  const body =
    typeof sections[activeSection] === 'string'
      ? (sections[activeSection] as string)
      : JSON.stringify(sections[activeSection] ?? '', null, 2);
  const [draft, setDraft] = useState(body);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    if (!onSaveSection || !canWrite) return;
    setBusy(true);
    setMsg('');
    try {
      await onSaveSection(activeSection, draft);
      setMsg('Đã lưu mục');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="csd-report-editor" data-testid="csd-report-editor">
      <aside className="csd-report-editor__outline page-card">
        <h3 className="kpi-section-title">Mục báo cáo</h3>
        <ul className="csd-report-outline">
          {keys.map((key) => (
            <li key={key}>
              <button
                type="button"
                className={activeSection === key ? 'is-active' : undefined}
                onClick={() => {
                  setActiveSection(key);
                  const next =
                    typeof sections[key] === 'string'
                      ? (sections[key] as string)
                      : JSON.stringify(sections[key] ?? '', null, 2);
                  setDraft(next);
                }}
              >
                {SECTION_LABELS[key] ?? key}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="csd-report-editor__body page-card stack-gap">
        <div className="csd-report-editor__head">
          <h3 className="kpi-section-title">{SECTION_LABELS[activeSection] ?? activeSection}</h3>
          <span className="csd-badge">{report.status}</span>
        </div>
        <textarea
          className="kpi-input csd-report-editor__textarea"
          rows={16}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          readOnly={!canWrite || report.status === 'sent'}
        />
        {canWrite && report.status !== 'sent' ? (
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void save()}>
            Lưu mục
          </button>
        ) : null}
        {msg ? <p className="muted">{msg}</p> : null}
      </section>

      <aside className="csd-report-editor__approval page-card stack-gap">
        <h3 className="kpi-section-title">Duyệt & gửi</h3>
        <p className="muted">Phiên bản {report.version}</p>
        {canWrite && report.status === 'draft' && onSubmitReview ? (
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void onSubmitReview()}>
            Gửi duyệt
          </button>
        ) : null}
        {canWrite && report.status === 'in_review' && onApprove ? (
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void onApprove()}>
            Duyệt
          </button>
        ) : null}
        {canWrite && report.status === 'approved' && onSend ? (
          <button type="button" className="btn btn-sm" disabled={busy} onClick={onSend}>
            Gửi PDF cho khách
          </button>
        ) : null}
        {report.status === 'sent' ? <p className="muted">Báo cáo đã gửi — không thể sửa.</p> : null}
      </aside>
    </div>
  );
}
