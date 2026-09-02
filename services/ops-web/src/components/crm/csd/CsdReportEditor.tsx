'use client';

import { useMemo, useRef, useState } from 'react';
import {
  CSD_REPORT_STATUS_LABELS,
  type CsdReportDetail,
  type CsdReportStatus,
} from '@/lib/crm/csd-api';

type CsdReportEditorProps = {
  report: CsdReportDetail;
  canWrite: boolean;
  canManage?: boolean;
  onSaveSection?: (key: string, value: string) => Promise<void>;
  onSubmitReview?: () => Promise<void>;
  onApprove?: () => Promise<void>;
  onRequestChanges?: (comment: string) => Promise<void>;
  onTransition?: (to: CsdReportStatus) => Promise<void>;
  onSend?: () => void;
  onSnapshot?: (input: { kind: 'minor' | 'major'; changelog: string }) => Promise<void>;
  onRevise?: () => Promise<void>;
};

const SECTION_LABELS: Record<string, string> = {
  cover: 'Bìa',
  executive_summary: 'Tóm tắt điều hành',
  ticket_sla: 'Ticket & SLA',
  work_completed: 'Công việc hoàn thành',
  risks: 'Rủi ro & chặn',
  next_week: 'Kế hoạch tuần tới',
  next_period: 'Kế hoạch kỳ tới',
  next_month: 'Kế hoạch tháng tới',
  kpi: 'KPI',
  channels: 'Kênh',
  appendix: 'Phụ lục',
  sla_kpis: 'KPI SLA',
  breaches: 'Vi phạm SLA',
  reopens: 'Mở lại',
  recommendations: 'Khuyến nghị',
  asks: 'Đề xuất / Asks',
};

const VIEW_ONLY = new Set<CsdReportStatus>([
  'sent',
  'cancelled',
  'archived',
  'viewed',
  'acknowledged',
]);

function outlineKeys(report: CsdReportDetail): string[] {
  if (Array.isArray(report.template_sections) && report.template_sections.length > 0) {
    return report.template_sections;
  }
  return Object.keys(report.sections_json ?? {});
}

function sectionText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'body' in value) {
    return String((value as { body: unknown }).body ?? '');
  }
  return value == null ? '' : JSON.stringify(value, null, 2);
}

function canSendReport(report: CsdReportDetail): boolean {
  const weekly = report.requires_approval === false || report.template_code === 'weekly_ops';
  if (report.status === 'draft' && weekly) return true;
  return report.status === 'approved' || report.status === 'scheduled';
}

function sendLabel(status: CsdReportStatus): string {
  if (status === 'draft') return 'Gửi PDF';
  if (status === 'scheduled') return 'Gửi ngay';
  return 'Gửi khách';
}

function versionAuthor(staffId?: number | null): string {
  return staffId != null ? `NV ${staffId}` : '—';
}

function versionWhen(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
}

export function CsdReportEditor({
  report,
  canWrite,
  canManage = false,
  onSaveSection,
  onSubmitReview,
  onApprove,
  onRequestChanges,
  onTransition,
  onSend,
  onSnapshot,
  onRevise,
}: CsdReportEditorProps) {
  const keys = useMemo(() => outlineKeys(report), [report]);
  const [activeSection, setActiveSection] = useState(keys[0] ?? '');
  const [tab, setTab] = useState<'content' | 'versions'>('content');
  const sections = report.sections_json ?? {};
  const [draft, setDraft] = useState(() => sectionText(sections[keys[0] ?? '']));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [changeComment, setChangeComment] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const readOnly = !canWrite || VIEW_ONLY.has(report.status);
  const showSend = canWrite && Boolean(onSend) && canSendReport(report);
  const versions = report.versions ?? [];

  function selectSection(key: string) {
    setActiveSection(key);
    setDraft(sectionText(sections[key]));
  }

  async function run(action: () => Promise<void>, okMsg: string) {
    setBusy(true);
    setMsg('');
    try {
      await action();
      setMsg(okMsg);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!onSaveSection || readOnly) return;
    await run(() => onSaveSection(activeSection, draft), 'Đã lưu mục');
  }

  async function snapshot() {
    if (!onSnapshot || readOnly) return;
    const changelog = window.prompt('Nhật ký thay đổi (tối thiểu 3 ký tự)');
    if (changelog == null) return;
    if (changelog.trim().length < 3) {
      setMsg('Nhật ký thay đổi cần tối thiểu 3 ký tự');
      return;
    }
    await run(() => onSnapshot({ kind: 'minor', changelog: changelog.trim() }), 'Đã lưu phiên bản');
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
                onClick={() => selectSection(key)}
              >
                {SECTION_LABELS[key] ?? key}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="csd-report-editor__body page-card stack-gap">
        <div className="csd-report-editor__tabs">
          <button
            type="button"
            className={tab === 'content' ? 'is-active' : undefined}
            onClick={() => setTab('content')}
          >
            Nội dung
          </button>
          <button
            type="button"
            className={tab === 'versions' ? 'is-active' : undefined}
            onClick={() => setTab('versions')}
          >
            Phiên bản
          </button>
        </div>
        {tab === 'content' ? (
          <>
            <div className="csd-report-editor__head">
              <h3 className="kpi-section-title">{SECTION_LABELS[activeSection] ?? activeSection}</h3>
              <span className="csd-badge">{CSD_REPORT_STATUS_LABELS[report.status] ?? report.status}</span>
            </div>
            <textarea
              ref={textareaRef}
              className="kpi-input csd-report-editor__textarea"
              rows={16}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              readOnly={readOnly}
            />
            {canWrite && !readOnly && onSaveSection ? (
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void save()}>
                Lưu mục
              </button>
            ) : null}
          </>
        ) : (
          <div className="csd-report-versions stack-gap" data-testid="csd-report-versions">
            <div className="csd-report-editor__head">
              <h3 className="kpi-section-title">Phiên bản</h3>
              <span className="csd-badge">{report.current_version ?? report.version ?? '—'}</span>
            </div>
            {versions.length === 0 ? (
              <p className="muted">Chưa có phiên bản đã lưu.</p>
            ) : (
              <ul className="csd-report-version-list">
                {versions.map((v) => (
                  <li key={v.id}>
                    {v.version} · {v.changelog?.trim() || '—'} · {versionAuthor(v.created_by_staff_id)} ·{' '}
                    {versionWhen(v.created_at)}
                  </li>
                ))}
              </ul>
            )}
            {canWrite && !readOnly && onSnapshot ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                data-testid="csd-report-snapshot"
                onClick={() => void snapshot()}
              >
                Lưu phiên bản
              </button>
            ) : null}
          </div>
        )}
        {msg ? <p className="muted">{msg}</p> : null}
      </section>

      <aside className="csd-report-editor__approval page-card stack-gap">
        <h3 className="kpi-section-title">Duyệt & gửi</h3>
        <p className="muted">Phiên bản {report.current_version ?? report.version ?? '—'}</p>

        {canWrite && report.status === 'draft' ? (
          <>
            {onSaveSection ? (
              <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void save()}>
                Lưu
              </button>
            ) : null}
            {onTransition ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                data-testid="csd-report-data-pending"
                onClick={() => void run(() => onTransition('data_pending'), 'Đã chuyển chờ dữ liệu')}
              >
                Chờ dữ liệu
              </button>
            ) : null}
            {onSubmitReview ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                data-testid="csd-report-submit-review"
                onClick={() => void run(onSubmitReview, 'Đã gửi duyệt')}
              >
                Gửi duyệt
              </button>
            ) : null}
          </>
        ) : null}

        {canWrite && report.status === 'data_pending' ? (
          <>
            {onTransition ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                onClick={() => void run(() => onTransition('draft'), 'Đã đủ dữ liệu')}
              >
                Đủ dữ liệu
              </button>
            ) : null}
            {onSubmitReview ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                data-testid="csd-report-submit-review"
                onClick={() => void run(onSubmitReview, 'Đã gửi duyệt')}
              >
                Gửi duyệt
              </button>
            ) : null}
          </>
        ) : null}

        {canManage && report.status === 'in_review' ? (
          <>
            {onApprove ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                data-testid="csd-report-approve"
                onClick={() => void run(onApprove, 'Đã duyệt')}
              >
                Duyệt
              </button>
            ) : null}
            {onRequestChanges ? (
              <>
                <textarea
                  className="kpi-input"
                  rows={3}
                  placeholder="Nhận xét khi yêu cầu sửa (tối thiểu 3 ký tự)"
                  value={changeComment}
                  onChange={(e) => setChangeComment(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={busy || changeComment.trim().length < 3}
                  data-testid="csd-report-request-changes"
                  onClick={() =>
                    void run(() => onRequestChanges(changeComment.trim()), 'Đã yêu cầu sửa')
                  }
                >
                  Yêu cầu sửa
                </button>
              </>
            ) : null}
          </>
        ) : null}

        {canWrite && report.status === 'changes_requested' ? (
          <>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => textareaRef.current?.focus()}
            >
              Sửa
            </button>
            {onSubmitReview ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                data-testid="csd-report-submit-review"
                onClick={() => void run(onSubmitReview, 'Đã gửi lại')}
              >
                Gửi lại
              </button>
            ) : null}
          </>
        ) : null}

        {canWrite && report.status === 'approved' ? (
          <>
            <button type="button" className="btn btn-sm btn-secondary" disabled>
              Xuất PDF
            </button>
            <button type="button" className="btn btn-sm btn-secondary" disabled>
              Lên lịch
            </button>
          </>
        ) : null}

        {canWrite && report.status === 'scheduled' && onTransition ? (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={busy}
            onClick={() => void run(() => onTransition('approved'), 'Đã huỷ lịch')}
          >
            Hủy lịch
          </button>
        ) : null}

        {showSend ? (
          <button type="button" className="btn btn-sm" disabled={busy} data-testid="csd-report-send" onClick={onSend}>
            {sendLabel(report.status)}
          </button>
        ) : null}

        {report.status === 'sent' ? (
          <>
            <p className="muted">Báo cáo đã gửi — không thể sửa.</p>
            {canWrite && onRevise ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                data-testid="csd-report-revise"
                onClick={() => void run(onRevise, 'Đã tạo bản sửa')}
              >
                Tạo bản sửa
              </button>
            ) : (
              <button type="button" className="btn btn-sm btn-secondary" disabled data-testid="csd-report-revise">
                Tạo bản sửa
              </button>
            )}
            <button type="button" className="btn btn-sm btn-secondary" disabled>
              Xem log
            </button>
          </>
        ) : null}

        {report.status === 'cancelled' || report.status === 'archived' ? (
          <p className="muted">Chỉ xem — không thao tác workflow.</p>
        ) : null}
      </aside>
    </div>
  );
}
