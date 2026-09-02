'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CSD_REPORT_STATUS_LABELS,
  normalizeCsdReportSection,
  type CsdReportBlock,
  type CsdReportDetail,
  type CsdReportSection,
  type CsdReportStatus,
} from '@/lib/crm/csd-api';

type CsdReportEditorProps = {
  report: CsdReportDetail;
  canWrite: boolean;
  canManage?: boolean;
  onSaveSection?: (key: string, section: CsdReportSection) => Promise<void>;
  onSubmitReview?: () => Promise<void>;
  onApprove?: () => Promise<void>;
  onRequestChanges?: (comment: string) => Promise<void>;
  onTransition?: (to: CsdReportStatus) => Promise<void>;
  onSend?: () => void;
  onSnapshot?: (input: { kind: 'minor' | 'major'; changelog: string }) => Promise<void>;
  onRevise?: () => Promise<void>;
  onRollup?: () => Promise<void>;
  onUploadFile?: (file: File) => Promise<{ id: string }>;
  onExportPdf?: () => Promise<void>;
  onExportXlsx?: () => Promise<void>;
  onLoadClientConversations?: () => Promise<{ id: string; name_vi: string }[]>;
  onShareChat?: (conversationId: string) => Promise<void>;
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

const REQUIRED_SECTIONS = new Set(['cover', 'executive_summary']);

const VIEW_ONLY = new Set<CsdReportStatus>([
  'sent',
  'cancelled',
  'archived',
  'viewed',
  'acknowledged',
]);

const ADD_BLOCK_OPTIONS: { type: CsdReportBlock['type']; label: string }[] = [
  { type: 'rich_text', label: 'Văn bản' },
  { type: 'kpi_table', label: 'Bảng KPI' },
  { type: 'chart', label: 'Biểu đồ' },
  { type: 'file', label: 'File' },
  { type: 'ticket_rollup', label: 'Rollup ticket' },
];

function outlineKeys(report: CsdReportDetail): string[] {
  if (Array.isArray(report.template_sections) && report.template_sections.length > 0) {
    return report.template_sections;
  }
  return Object.keys(report.sections_json ?? {});
}

function draftsFromReport(report: CsdReportDetail): Record<string, CsdReportSection> {
  const out: Record<string, CsdReportSection> = {};
  for (const key of outlineKeys(report)) {
    out[key] = normalizeCsdReportSection(report.sections_json?.[key]);
  }
  return out;
}

function sectionHasText(section: CsdReportSection | undefined): boolean {
  return Boolean(
    section?.blocks.some((b) => b.type === 'rich_text' && b.body.trim().length >= 10),
  );
}

function emptyBlock(type: CsdReportBlock['type']): CsdReportBlock {
  if (type === 'kpi_table') return { type, rows: [{ metric: '', value: '' }] };
  if (type === 'chart') return { type, title: '', labels: ['A'], values: [0] };
  if (type === 'file') return { type, attachment_id: '' };
  if (type === 'ticket_rollup') return { type, ticket_ids: [], summary: '' };
  return { type: 'rich_text', body: '' };
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

function ChartBars({ title, labels, values }: { title: string; labels: string[]; values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="csd-report-chart">
      {title ? <h4 className="csd-report-chart__title">{title}</h4> : null}
      <div className="csd-report-chart__bars">
        {labels.map((label, i) => {
          const value = Number(values[i] ?? 0);
          const pct = Math.max(0, Math.min(100, (value / max) * 100));
          return (
            <div key={`${label}-${i}`} className="csd-report-chart__row">
              <span className="csd-report-chart__label">{label}</span>
              <div className="csd-report-chart__track">
                <div className="csd-report-chart__bar" style={{ width: `${pct}%` }} />
              </div>
              <span className="csd-report-chart__value">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  onRollup,
  onUploadFile,
  onExportPdf,
  onExportXlsx,
  onLoadClientConversations,
  onShareChat,
}: CsdReportEditorProps) {
  const keys = useMemo(() => outlineKeys(report), [report]);
  const [activeSection, setActiveSection] = useState(keys[0] ?? '');
  const [tab, setTab] = useState<'content' | 'versions'>('content');
  const [drafts, setDrafts] = useState(() => draftsFromReport(report));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [changeComment, setChangeComment] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareConversations, setShareConversations] = useState<{ id: string; name_vi: string }[]>([]);
  const [shareConversationId, setShareConversationId] = useState('');
  const canShareChat =
    canWrite &&
    Boolean(onShareChat) &&
    (report.status === 'sent' || report.status === 'approved');
  const readOnly = !canWrite || VIEW_ONLY.has(report.status);
  const showSend = canWrite && Boolean(onSend) && canSendReport(report);
  const versions = report.versions ?? [];
  const section = drafts[activeSection] ?? { blocks: [{ type: 'rich_text' as const, body: '' }] };

  useEffect(() => {
    setDrafts(draftsFromReport(report));
    setActiveSection((current) => {
      const nextKeys = outlineKeys(report);
      return nextKeys.includes(current) ? current : (nextKeys[0] ?? '');
    });
  }, [report]);

  function patchSection(updater: (current: CsdReportSection) => CsdReportSection) {
    setDrafts((prev) => ({
      ...prev,
      [activeSection]: updater(prev[activeSection] ?? { blocks: [{ type: 'rich_text', body: '' }] }),
    }));
  }

  function setBlock(index: number, block: CsdReportBlock) {
    patchSection((current) => ({
      blocks: current.blocks.map((b, i) => (i === index ? block : b)),
    }));
  }

  function addBlock(type: CsdReportBlock['type']) {
    patchSection((current) => ({ blocks: [...current.blocks, emptyBlock(type)] }));
  }

  function removeBlock(index: number) {
    patchSection((current) => {
      const next = current.blocks.filter((_, i) => i !== index);
      return { blocks: next.length ? next : [{ type: 'rich_text', body: '' }] };
    });
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
    await run(() => onSaveSection(activeSection, section), 'Đã lưu mục');
  }

  async function openShareChat() {
    if (!canShareChat) return;
    setShareOpen(true);
    setMsg('');
    if (!onLoadClientConversations) return;
    setBusy(true);
    try {
      const items = await onLoadClientConversations();
      setShareConversations(items);
      setShareConversationId((current) =>
        items.some((c) => c.id === current) ? current : (items[0]?.id ?? ''),
      );
      if (items.length === 0) {
        setMsg('Chưa có chat khách. Tạo hội thoại khách trước.');
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Không tải được hội thoại khách');
    } finally {
      setBusy(false);
    }
  }

  async function confirmShareChat() {
    if (!onShareChat || !shareConversationId) return;
    await run(() => onShareChat(shareConversationId), 'Đã chia sẻ vào chat khách');
    setShareOpen(false);
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
          {keys.map((key) => {
            const missing = REQUIRED_SECTIONS.has(key) && !sectionHasText(drafts[key]);
            return (
              <li key={key}>
                <button
                  type="button"
                  className={activeSection === key ? 'is-active' : undefined}
                  onClick={() => setActiveSection(key)}
                >
                  {missing ? (
                    <span className="csd-report-outline__missing" aria-label="Thiếu dữ liệu" />
                  ) : null}
                  {SECTION_LABELS[key] ?? key}
                </button>
              </li>
            );
          })}
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
            <div className="csd-report-blocks">
              {section.blocks.map((block, index) => (
                <article key={`${block.type}-${index}`} className="csd-report-block">
                  <div className="csd-report-block__head">
                    <strong>
                      {ADD_BLOCK_OPTIONS.find((o) => o.type === block.type)?.label ?? block.type}
                    </strong>
                    {canWrite && !readOnly ? (
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => removeBlock(index)}>
                        Xóa
                      </button>
                    ) : null}
                  </div>
                  {block.type === 'rich_text' ? (
                    <textarea
                      className="kpi-input csd-report-editor__textarea"
                      rows={8}
                      value={block.body}
                      onChange={(e) => setBlock(index, { type: 'rich_text', body: e.target.value })}
                      readOnly={readOnly}
                    />
                  ) : null}
                  {block.type === 'kpi_table' ? (
                    <div className="stack-gap">
                      <table className="csd-report-kpi">
                        <thead>
                          <tr>
                            <th>Chỉ số</th>
                            <th>Giá trị</th>
                            <th>Mục tiêu</th>
                            <th>Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          {block.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {(['metric', 'value', 'target', 'note'] as const).map((field) => (
                                <td key={field}>
                                  <input
                                    className="kpi-input"
                                    value={row[field] ?? ''}
                                    readOnly={readOnly}
                                    onChange={(e) => {
                                      const rows = block.rows.map((r, i) =>
                                        i === rowIndex ? { ...r, [field]: e.target.value } : r,
                                      );
                                      setBlock(index, { type: 'kpi_table', rows });
                                    }}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {canWrite && !readOnly ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() =>
                            setBlock(index, {
                              type: 'kpi_table',
                              rows: [...block.rows, { metric: '', value: '' }],
                            })
                          }
                        >
                          Thêm dòng
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {block.type === 'chart' ? (
                    <div className="stack-gap">
                      <input
                        className="kpi-input"
                        placeholder="Tiêu đề biểu đồ"
                        value={block.title}
                        readOnly={readOnly}
                        onChange={(e) => setBlock(index, { ...block, title: e.target.value })}
                      />
                      <input
                        className="kpi-input"
                        placeholder="Nhãn (phẩy)"
                        value={block.labels.join(', ')}
                        readOnly={readOnly}
                        onChange={(e) =>
                          setBlock(index, {
                            ...block,
                            labels: e.target.value.split(',').map((s) => s.trim()),
                          })
                        }
                      />
                      <input
                        className="kpi-input"
                        placeholder="Giá trị (phẩy)"
                        value={block.values.join(', ')}
                        readOnly={readOnly}
                        onChange={(e) =>
                          setBlock(index, {
                            ...block,
                            values: e.target.value.split(',').map((s) => Number(s.trim()) || 0),
                          })
                        }
                      />
                      <ChartBars title={block.title} labels={block.labels} values={block.values} />
                    </div>
                  ) : null}
                  {block.type === 'file' ? (
                    <div className="stack-gap">
                      <input
                        className="kpi-input"
                        placeholder="attachment_id"
                        value={block.attachment_id}
                        readOnly={readOnly}
                        onChange={(e) => setBlock(index, { ...block, attachment_id: e.target.value })}
                      />
                      <input
                        className="kpi-input"
                        placeholder="Chú thích"
                        value={block.caption ?? ''}
                        readOnly={readOnly}
                        onChange={(e) => setBlock(index, { ...block, caption: e.target.value })}
                      />
                      {canWrite && !readOnly && onUploadFile ? (
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            void run(async () => {
                              const uploaded = await onUploadFile(file);
                              patchSection((current) => ({
                                blocks: current.blocks.map((b, i) =>
                                  i === index && b.type === 'file'
                                    ? { ...b, attachment_id: uploaded.id }
                                    : b,
                                ),
                              }));
                            }, 'Đã tải file');
                          }}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {block.type === 'ticket_rollup' ? (
                    <div className="stack-gap">
                      <input
                        className="kpi-input"
                        placeholder="ticket_ids (phẩy)"
                        value={block.ticket_ids.join(', ')}
                        readOnly={readOnly}
                        onChange={(e) =>
                          setBlock(index, {
                            ...block,
                            ticket_ids: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                      />
                      <textarea
                        className="kpi-input"
                        rows={4}
                        placeholder="Tóm tắt rollup"
                        value={block.summary}
                        readOnly={readOnly}
                        onChange={(e) => setBlock(index, { ...block, summary: e.target.value })}
                      />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            {canWrite && !readOnly ? (
              <div className="csd-report-add-block" data-testid="csd-report-add-block">
                <span>Thêm khối</span>
                {ADD_BLOCK_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={busy}
                    onClick={() => addBlock(opt.type)}
                  >
                    {opt.label}
                  </button>
                ))}
                {onRollup ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    data-testid="csd-report-rollup"
                    onClick={() => void run(onRollup, 'Đã gộp ticket')}
                  >
                    Gộp ticket kỳ này
                  </button>
                ) : null}
              </div>
            ) : null}
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
              onClick={() => setTab('content')}
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

        {onExportPdf ? (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={busy}
            data-testid="csd-report-export-pdf"
            onClick={() => void run(onExportPdf, 'Đã tải PDF')}
          >
            Xuất PDF
          </button>
        ) : null}
        {onExportXlsx ? (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={busy}
            data-testid="csd-report-export-xlsx"
            onClick={() => void run(onExportXlsx, 'Đã tải Excel')}
          >
            Xuất Excel
          </button>
        ) : null}

        {canWrite && report.status === 'approved' && onSend ? (
          <button type="button" className="btn btn-sm btn-secondary" onClick={onSend}>
            Lên lịch
          </button>
        ) : canWrite && report.status === 'approved' ? (
          <button type="button" className="btn btn-sm btn-secondary" disabled>
            Lên lịch
          </button>
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

        {canShareChat ? (
          <>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              data-testid="csd-report-share-chat"
              onClick={() => void openShareChat()}
            >
              Chia sẻ vào chat
            </button>
            {shareOpen ? (
              <div className="stack-gap" data-testid="csd-report-share-chat-picker">
                {shareConversations.length === 0 ? (
                  <p className="muted">Chưa có chat khách. Tạo hội thoại khách trước.</p>
                ) : (
                  <>
                    <label className="stack-gap">
                      Hội thoại khách
                      <select
                        className="kpi-input"
                        data-testid="csd-report-share-chat-select"
                        value={shareConversationId}
                        onChange={(e) => setShareConversationId(e.target.value)}
                      >
                        {shareConversations.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name_vi}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy || !shareConversationId}
                      onClick={() => void confirmShareChat()}
                    >
                      Gửi vào chat
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </>
        ) : null}

        {report.status === 'sent' ? (
          <>
            <p className="muted">Báo cáo đã gửi — sửa sẽ tạo phiên bản mới.</p>
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
