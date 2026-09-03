'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  IWR_RAG_LABELS,
  IWR_STATUS_LABELS,
  addIwrItem,
  applyIwrSources,
  deleteIwrItem,
  fetchIwrDirectory,
  fetchIwrFiles,
  fetchIwrItems,
  fetchIwrSources,
  iwrPdfUrl,
  patchIwrItem,
  promoteIwrBlockerToRisk,
  replyAllIwrReport,
  uploadIwrFile,
  type IwrCommentRow,
  type IwrFileRow,
  type IwrItemRow,
  type IwrRag,
  type IwrReportDetail,
  type IwrReportRow,
  type IwrReportStatus,
} from '@/lib/crm/iwr-api';
import { iwrAvatarTone, iwrInitials, iwrRagClass, iwrRagLabel, iwrWeekHeading } from './iwr-format';
import { IwrPeoplePicker, type IwrPersonChip } from './IwrPeoplePicker';
import {
  clampProgress,
  formatKpiNumber,
  formatViYmd,
  kpiDelta,
  parseIwrItemMeta,
  serializeIwrItemMeta,
  type IwrItemMeta,
  type IwrItemSeverity,
} from './iwr-item-meta';

type Props = {
  token: string;
  report: IwrReportDetail;
  canWrite: boolean;
  canReview: boolean;
  canBcc?: boolean;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onSubmit: (body: {
    late_reason?: string;
    to_staff_id?: number;
    cc_staff_ids?: number[];
    bcc_staff_ids?: number[];
  }) => Promise<void>;
  onWithdraw: () => Promise<void>;
  onAck: () => Promise<void>;
  onRequestChanges: (body: { body_text: string; section_key?: string }) => Promise<void>;
  onAddComment: (body: { body_text: string; section_key?: string }) => Promise<void>;
  onReplyAll?: (body: { body_text: string }) => Promise<void>;
  comments: IwrCommentRow[];
};

const IMMUTABLE = new Set<IwrReportStatus>(['acknowledged', 'waived', 'archived']);
const EDITABLE = new Set<IwrReportStatus>(['draft', 'changes_requested']);
const PROJECT_STEPS = ['Brief & Plan', 'Setup', 'Triển khai', 'Tối ưu', 'Báo cáo'];

function daysInPeriod(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00+07:00`);
  const last = new Date(`${end}T12:00:00+07:00`);
  while (cur.getTime() <= last.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function doneCount(row: IwrReportRow): number {
  const body = String(row.sections_json?.done?.body ?? '').trim();
  if (!body) return 0;
  return body.split(/\n+/).filter((line) => line.trim()).length;
}

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function readOverview(report: IwrReportDetail): string {
  const sec = report.sections_json?.highlights;
  return String((sec as { body?: string } | undefined)?.body ?? '');
}

export function IwrWeeklyReportEditor({
  token,
  report,
  canWrite,
  canReview,
  canBcc = false,
  onPatch,
  onSubmit,
  onWithdraw,
  onAck,
  onRequestChanges,
  onAddComment,
  onReplyAll,
  comments,
}: Props) {
  const isAuthor = report.viewer_is_author !== false;
  const isReviewer = Boolean(report.viewer_is_reviewer);
  const readOnly = IMMUTABLE.has(report.status) || !isAuthor || !EDITABLE.has(report.status);
  const toRecipient = report.recipients.find((r) => r.kind === 'to');
  const ccRecipients = report.recipients.filter((r) => r.kind === 'cc');

  const [items, setItems] = useState<IwrItemRow[]>(report.items ?? []);
  const [overview, setOverview] = useState(readOverview(report));
  const [rag, setRag] = useState<IwrRag>(report.rag);
  const [toPerson, setToPerson] = useState<IwrPersonChip | null>(
    toRecipient ? { id: toRecipient.staff_id, name: toRecipient.staff_name ?? `#${toRecipient.staff_id}` } : null,
  );
  const [ccPeople, setCcPeople] = useState<IwrPersonChip[]>(
    ccRecipients.map((r) => ({ id: r.staff_id, name: r.staff_name ?? `#${r.staff_id}` })),
  );
  const [bccPeople, setBccPeople] = useState<IwrPersonChip[]>(
    report.recipients
      .filter((r) => r.kind === 'bcc')
      .map((r) => ({ id: r.staff_id, name: r.staff_name ?? `#${r.staff_id}` })),
  );
  const [sources, setSources] = useState<IwrReportRow[]>([]);
  const [picked, setPicked] = useState<string[]>(report.source_report_ids ?? []);
  const [files, setFiles] = useState<IwrFileRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [lateOpen, setLateOpen] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeBody, setChangeBody] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    void fetchIwrItems(token, report.id).then((out) => setItems(out.items ?? [])).catch(() => undefined);
    void fetchIwrSources(token, report.id).then((out) => setSources(out.items ?? [])).catch(() => undefined);
    void fetchIwrFiles(token, report.id).then((out) => setFiles(out.items ?? [])).catch(() => undefined);
    if (!toRecipient) {
      void fetchIwrDirectory(token, '', 'to')
        .then((out) => {
          const first = out.items?.[0];
          if (first) setToPerson((cur) => cur ?? { id: first.id, name: first.name });
        })
        .catch(() => undefined);
    }
  }, [token, report.id, toRecipient]);

  useEffect(() => {
    setOverview(readOverview(report));
    setRag(report.rag);
    const nextTo = report.recipients.find((r) => r.kind === 'to');
    if (nextTo) setToPerson({ id: nextTo.staff_id, name: nextTo.staff_name ?? `#${nextTo.staff_id}` });
    setCcPeople(
      report.recipients
        .filter((r) => r.kind === 'cc')
        .map((r) => ({ id: r.staff_id, name: r.staff_name ?? `#${r.staff_id}` })),
    );
    setBccPeople(
      report.recipients
        .filter((r) => r.kind === 'bcc')
        .map((r) => ({ id: r.staff_id, name: r.staff_name ?? `#${r.staff_id}` })),
    );
    if (report.source_report_ids) setPicked(report.source_report_ids);
    if (report.items?.length) setItems(report.items);
  }, [report]);

  const highlights = items.filter((it) => it.section_key === 'highlights');
  const kpis = items.filter((it) => it.section_key === 'kpi');
  const projects = items.filter((it) => it.section_key === 'wip' || it.section_key === 'deliverables');
  const nextWeek = items.filter((it) => it.section_key === 'next_week');
  const blockers = items.filter((it) => it.section_key === 'blocked' || it.section_key === 'decisions');

  const chartDays = useMemo(() => {
    const days = daysInPeriod(report.period_start, report.period_end);
    return days.map((day) => {
      const src = sources.filter((s) => s.period_start === day);
      const count = src.reduce((sum, row) => sum + doneCount(row), 0);
      return { day, count };
    });
  }, [report.period_start, report.period_end, sources]);
  const chartMax = Math.max(1, ...chartDays.map((d) => d.count));

  const buildSections = useCallback(
    (text: string, rows: IwrItemRow[], nextRag: IwrRag) => {
      const of = (key: string) => rows.filter((it) => it.section_key === key);
      const line = (it: IwrItemRow) => it.title;
      const blocked = of('blocked').map((it) => {
        const meta = parseIwrItemMeta(it.body);
        return { title: it.title, description: meta.note ?? meta.text ?? '', severity: meta.severity ?? 'medium' };
      });
      return {
        ...(report.sections_json ?? {}),
        rag: { body: nextRag ?? '', items: [] },
        highlights: { body: text, items: of('highlights').map((it) => ({ title: it.title })) },
        kpi: { body: of('kpi').map(line).join('\n'), items: [] },
        wip: { body: of('wip').map(line).join('\n'), items: [] },
        deliverables: { body: of('deliverables').map(line).join('\n'), items: [] },
        next_week: { body: of('next_week').map(line).join('\n'), items: [] },
        blocked: { body: blocked.map((b) => b.title).join('\n'), items: blocked },
        decisions: { body: of('decisions').map(line).join('\n'), items: [] },
      };
    },
    [report.sections_json],
  );

  const persistDraft = useCallback(
    async (
      text = overview,
      nextRag = rag,
      nextCc = ccPeople.map((p) => p.id),
      nextItems = items,
      nextTo = toPerson?.id,
    ) => {
      if (readOnly) return;
      await onPatch({
        title: iwrWeekHeading(report.period_start, report.period_end),
        sections_json: buildSections(text, nextItems, nextRag),
        rag: nextRag ?? undefined,
        to_staff_id: nextTo,
        cc_staff_ids: nextCc,
      });
    },
    [readOnly, onPatch, overview, rag, ccPeople, toPerson, items, report.period_start, report.period_end, buildSections],
  );

  const scheduleDraft = useCallback(
    (
      text = overview,
      nextRag = rag,
      nextCc = ccPeople.map((p) => p.id),
      nextItems = items,
      nextTo = toPerson?.id,
    ) => {
      if (readOnly) return;
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(() => {
        void persistDraft(text, nextRag, nextCc, nextItems, nextTo).catch((err) => {
          setFormError(err instanceof Error ? err.message : 'Lưu nháp thất bại');
        });
      }, 700);
    },
    [readOnly, persistDraft, overview, rag, ccPeople, items],
  );

  function scheduleItemPatch(row: IwrItemRow) {
    if (readOnly) return;
    if (itemTimers.current[row.id]) clearTimeout(itemTimers.current[row.id]);
    itemTimers.current[row.id] = setTimeout(() => {
      void patchIwrItem(token, report.id, row.id, {
        title: row.title,
        body: row.body,
        section_key: row.section_key,
        evidence_url: row.evidence_url,
        sort_order: row.sort_order,
      }).catch((err) => setFormError(err instanceof Error ? err.message : 'Lưu dòng thất bại'));
    }, 400);
  }

  function replaceItem(next: IwrItemRow) {
    setItems((prev) => {
      const rows = prev.map((it) => (it.id === next.id ? next : it));
      scheduleDraft(overview, rag, ccPeople.map((p) => p.id), rows);
      return rows;
    });
    scheduleItemPatch(next);
  }

  function updateMeta(row: IwrItemRow, patch: Partial<IwrItemMeta>, extra?: Partial<IwrItemRow>) {
    replaceItem({ ...row, ...extra, body: serializeIwrItemMeta({ ...parseIwrItemMeta(row.body), ...patch }) });
  }

  async function createItem(section: string, seed?: Partial<IwrItemRow>, meta?: IwrItemMeta) {
    if (readOnly) return;
    setBusy(true);
    setFormError('');
    try {
      const defaults: Record<string, IwrItemMeta> = {
        highlights: {},
        kpi: { target: 0, actual: 0, unit: '', better: 'higher' },
        wip: { progress: 40, step: 2, eta: '' },
        next_week: { checked: false },
        blocked: { severity: 'high', due: '', owner: '' },
      };
      const row = await addIwrItem(token, report.id, {
        section_key: section,
        title: seed?.title ?? (section === 'kpi' ? 'KPI mới' : section === 'blocked' ? 'Rủi ro mới' : 'Mục mới'),
        body: seed?.body ?? serializeIwrItemMeta(meta ?? defaults[section] ?? {}),
        ref_kind: 'none',
        ref_id: null,
        evidence_url: null,
        sort_order: items.filter((it) => it.section_key === section).length,
      });
      setItems((prev) => {
        const rows = [...prev, row];
        scheduleDraft(overview, rag, ccPeople.map((p) => p.id), rows);
        return rows;
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Thêm dòng thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    if (readOnly) return;
    await deleteIwrItem(token, report.id, id);
    setItems((prev) => {
      const rows = prev.filter((it) => it.id !== id);
      scheduleDraft(overview, rag, ccPeople.map((p) => p.id), rows);
      return rows;
    });
  }

  async function handleSubmit() {
    if (!rag) {
      setFormError('Chọn RAG (Xanh / Vàng / Đỏ) trước khi gửi');
      return;
    }
    const due = new Date(report.due_at).getTime();
    if (Date.now() > due && !lateReason.trim()) {
      setLateOpen(true);
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await persistDraft();
      await onSubmit({
        late_reason: lateReason.trim() || undefined,
        to_staff_id: toPerson?.id,
        cc_staff_ids: ccPeople.map((p) => p.id),
        bcc_staff_ids: canBcc ? bccPeople.map((p) => p.id) : undefined,
      });
      setLateOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gửi báo cáo thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function mergeDailies() {
    const ids = sources.map((s) => s.id);
    if (!ids.length) {
      setFormError('Chưa có báo cáo ngày đã nộp trong tuần này');
      return;
    }
    setBusy(true);
    try {
      const updated = await applyIwrSources(token, report.id, ids);
      setPicked(ids);
      if (updated.sections_json) setOverview(readOverview(updated));
      if (updated.rag) setRag(updated.rag);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gộp ngày thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function attachFile(file: File) {
    setBusy(true);
    try {
      const uploaded = await uploadIwrFile(token, report.id, file);
      setFiles((prev) => [uploaded, ...prev]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Tải file thất bại');
    } finally {
      setBusy(false);
    }
  }

  const heading = iwrWeekHeading(report.period_start, report.period_end);

  return (
    <div className="iwr-week">
      <div className="iwr-crumb">
        <Link href="/crm/internal-reports">Báo cáo công việc</Link>
        <span>/</span>
        <Link href="/crm/internal-reports?kind=weekly">Báo cáo tuần</Link>
      </div>

      <div className="iwr-daily__head">
        <div>
          <h1 className="iwr-h1">
            {heading}
            <span className={iwrRagClass(rag)}>{iwrRagLabel(rag)}</span>
            {report.status === 'draft' ? <span className="iwr-chip iwr-chip--draft">Bản nháp</span> : (
              <span className={`iwr-chip iwr-chip--${report.status}`}>{IWR_STATUS_LABELS[report.status]}</span>
            )}
          </h1>
        </div>
        <div className="iwr-pagehead__actions">
          <a className="iwr-btn" href={iwrPdfUrl(report.id)} target="_blank" rel="noreferrer">
            Xem bản tổng hợp
          </a>
          {isAuthor && canWrite && EDITABLE.has(report.status) && (
            <button
              type="button"
              className="iwr-btn iwr-btn--primary"
              aria-label="Nộp"
              disabled={busy}
              onClick={() => void handleSubmit()}
            >
              Gửi báo cáo tuần
            </button>
          )}
          {isAuthor && (report.status === 'submitted' || report.status === 'supplemented') && canWrite && (
            <button type="button" className="iwr-btn" disabled={busy} onClick={() => void onWithdraw()}>
              Rút
            </button>
          )}
          {canReview && isReviewer && (report.status === 'submitted' || report.status === 'supplemented') && (
            <>
              <button type="button" className="iwr-btn iwr-btn--primary" disabled={busy} onClick={() => void onAck()}>
                Xác nhận
              </button>
              <button type="button" className="iwr-btn" onClick={() => setChangeOpen(true)}>
                Yêu cầu bổ sung
              </button>
            </>
          )}
        </div>
      </div>

      <div className="iwr-notice">Nội bộ — không gửi khách trừ khi đã duyệt ngoại</div>
      {formError && <p className="iwr-err">{formError}</p>}

      <section className="iwr-mail">
        <IwrPeoplePicker
          token={token}
          purpose="to"
          label="Đến"
          placeholder="Tìm người nhận..."
          selected={toPerson ? [toPerson] : []}
          onChange={(next) => {
            const person = next[0] ?? null;
            setToPerson(person);
            scheduleDraft(overview, rag, ccPeople.map((p) => p.id), items, person?.id);
          }}
          disabled={readOnly}
          multiple={false}
          hint="Người nhận chính"
        />
        <IwrPeoplePicker
          token={token}
          purpose="cc"
          label="Cc"
          placeholder="Thêm Cc…"
          selected={ccPeople}
          onChange={(next) => {
            setCcPeople(next);
            scheduleDraft(overview, rag, next.map((p) => p.id), items);
          }}
          disabled={readOnly}
        />
        <div className="iwr-mail__cell iwr-mail__cell--grow">
          <div className="iwr-mail__k">Tệp đính kèm</div>
          <div className="iwr-files">
            <a className="iwr-file" href={iwrPdfUrl(report.id)} target="_blank" rel="noreferrer">
              <strong>Báo cáo tuần.pdf</strong>
              <span className="iwr-muted">Bản tổng hợp</span>
            </a>
            {files.map((f) => (
              <span key={f.id} className="iwr-file">
                <strong>{f.file_name}</strong>
                <span className="iwr-muted">{fmtBytes(f.byte_size)}</span>
              </span>
            ))}
            {!readOnly && (
              <label className="iwr-link">
                + Tải file
                <input
                  type="file"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void attachFile(file);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        </div>
        {canBcc && !readOnly && isAuthor && (
          <IwrPeoplePicker
            token={token}
            purpose="bcc"
            label="Bcc"
            placeholder="Tìm Bcc..."
            selected={bccPeople}
            onChange={setBccPeople}
            testId="iwr-bcc"
            className="iwr-mail__cell--full"
          />
        )}
      </section>

      {!readOnly && (
        <div className="iwr-card iwr-week__rag">
          <div className="iwr-mail__k">RAG (bắt buộc trước khi gửi)</div>
          <div className="iwr-suggest-row">
            {(Object.keys(IWR_RAG_LABELS) as Exclude<IwrRag, null>[]).map((v) => (
              <button
                key={v}
                type="button"
                className={`iwr-btn${rag === v ? ' iwr-btn--primary' : ''}`}
                onClick={() => {
                  setRag(v);
                  scheduleDraft(overview, v, ccPeople.map((p) => p.id), items);
                }}
              >
                {IWR_RAG_LABELS[v]}
              </button>
            ))}
            <button type="button" className="iwr-btn" disabled={busy || !sources.length} onClick={() => void mergeDailies()}>
              Gộp báo cáo ngày ({sources.length})
            </button>
          </div>
          {report.rag_hint && (
            <p className="iwr-muted">
              Gợi ý: {IWR_RAG_LABELS[report.rag_hint.rag]}
              {report.rag_hint.reasons.length ? ` — ${report.rag_hint.reasons.join(', ')}` : ''}
            </p>
          )}
        </div>
      )}

      <div className="iwr-daily__grid">
        <div className="iwr-daily__main">
          <section className="iwr-card">
            <div className="iwr-cardhead">
              <h2>Tổng quan tuần</h2>
              <span className={iwrRagClass(rag)}>{iwrRagLabel(rag)}</span>
            </div>
            <textarea
              className="iwr-input"
              disabled={readOnly}
              rows={3}
              placeholder="Tóm tắt tuần: lead, CPL, blocker…"
              value={overview}
              onChange={(e) => {
                setOverview(e.target.value);
                scheduleDraft(e.target.value, rag, ccPeople.map((p) => p.id), items);
              }}
            />
            <h3 className="iwr-week__sub">Kết quả nổi bật</h3>
            <ol className="iwr-highlights">
              {highlights.map((it, idx) => (
                <li key={it.id}>
                  <span className="iwr-hi">{idx + 1}</span>
                  <input
                    className="iwr-ghost"
                    disabled={readOnly}
                    value={it.title}
                    onChange={(e) => replaceItem({ ...it, title: e.target.value })}
                  />
                  {!readOnly && (
                    <button type="button" className="iwr-iconbtn" onClick={() => void removeItem(it.id)}>
                      Xoá
                    </button>
                  )}
                </li>
              ))}
            </ol>
            {!readOnly && (
              <button type="button" className="iwr-add" onClick={() => void createItem('highlights')}>
                + Thêm kết quả nổi bật
              </button>
            )}
          </section>

          <section className="iwr-card">
            <h2>KPI &amp; Tiến độ</h2>
            <table className="iwr-table">
              <thead>
                <tr>
                  <th>KPI</th>
                  <th>Mục tiêu</th>
                  <th>Thực tế</th>
                  <th>Chênh lệch</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {kpis.map((it) => {
                  const meta = parseIwrItemMeta(it.body);
                  const target = Number(meta.target ?? 0);
                  const actual = Number(meta.actual ?? 0);
                  const better = meta.better === 'lower' ? 'lower' : 'higher';
                  const delta = kpiDelta(target, actual, better);
                  return (
                    <tr key={it.id}>
                      <td>
                        <input
                          className="iwr-ghost"
                          disabled={readOnly}
                          value={it.title}
                          onChange={(e) => replaceItem({ ...it, title: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="iwr-input"
                          disabled={readOnly}
                          value={target}
                          onChange={(e) => updateMeta(it, { target: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="iwr-input"
                          disabled={readOnly}
                          value={actual}
                          onChange={(e) => updateMeta(it, { actual: Number(e.target.value) })}
                        />
                      </td>
                      <td className={delta.diff >= 0 ? 'iwr-pos' : 'iwr-neg'}>
                        {delta.diff >= 0 ? '+' : ''}
                        {formatKpiNumber(delta.diff, meta.unit)} ({delta.pct >= 0 ? '+' : ''}
                        {delta.pct.toFixed(1)}%)
                      </td>
                      <td>
                        <span className={delta.good ? 'iwr-rag iwr-rag--green' : 'iwr-rag iwr-rag--yellow'}>
                          {delta.good ? 'Tốt' : 'Cần cải thiện'}
                        </span>
                        {!readOnly && (
                          <select
                            className="iwr-input"
                            value={better}
                            onChange={(e) => updateMeta(it, { better: e.target.value as 'higher' | 'lower' })}
                          >
                            <option value="higher">Cao hơn = tốt</option>
                            <option value="lower">Thấp hơn = tốt</option>
                          </select>
                        )}
                      </td>
                      <td>
                        {!readOnly && (
                          <button type="button" className="iwr-iconbtn" onClick={() => void removeItem(it.id)}>
                            Xoá
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!kpis.length && (
                  <tr>
                    <td colSpan={6} className="iwr-empty">
                      Chưa có KPI
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {!readOnly && (
              <button type="button" className="iwr-add" onClick={() => void createItem('kpi')}>
                + Thêm KPI
              </button>
            )}
          </section>

          <section className="iwr-card">
            <h2>Dự án / công việc đang triển khai</h2>
            {projects.map((it) => {
              const meta = parseIwrItemMeta(it.body);
              const progress = clampProgress(meta.progress ?? 0);
              const step = Math.max(0, Math.min(PROJECT_STEPS.length - 1, Number(meta.step ?? Math.round(progress / 25))));
              return (
                <article key={it.id} className="iwr-proj">
                  <div className="iwr-proj__top">
                    <input
                      className="iwr-ghost iwr-proj__name"
                      disabled={readOnly}
                      value={it.title}
                      onChange={(e) => replaceItem({ ...it, title: e.target.value })}
                    />
                    {!readOnly && (
                      <button type="button" className="iwr-iconbtn" onClick={() => void removeItem(it.id)}>
                        Xoá
                      </button>
                    )}
                  </div>
                  <div className="iwr-progress">
                    <div className="iwr-bar">
                      <span style={{ width: `${progress}%`, background: 'var(--iwr-blue)' }} />
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={readOnly}
                      value={progress}
                      onChange={(e) => updateMeta(it, { progress: clampProgress(e.target.value) })}
                    />
                    <span>%</span>
                    <label className="iwr-muted">
                      Hạn{' '}
                      <input
                        type="date"
                        className="iwr-input"
                        disabled={readOnly}
                        value={meta.eta ?? ''}
                        onChange={(e) => updateMeta(it, { eta: e.target.value })}
                      />
                    </label>
                  </div>
                  <ol className="iwr-steps">
                    {PROJECT_STEPS.map((label, idx) => (
                      <li key={label} className={idx < step ? 'is-done' : idx === step ? 'is-on' : ''}>
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => updateMeta(it, { step: idx, progress: Math.min(100, idx * 25) })}
                        >
                          <i />
                          {label}
                        </button>
                      </li>
                    ))}
                  </ol>
                </article>
              );
            })}
            {!readOnly && (
              <button type="button" className="iwr-add" onClick={() => void createItem('wip')}>
                + Thêm dự án
              </button>
            )}
            {!projects.length && <p className="iwr-empty">Chưa có dự án đang triển khai</p>}
          </section>

          <section className="iwr-card">
            <h2>Số task hoàn thành theo ngày</h2>
            <div className="iwr-chart" role="img" aria-label="Task hoàn thành theo ngày">
              {chartDays.map((d) => (
                <div key={d.day} className="iwr-chart__col">
                  <span className="iwr-chart__val">{d.count || ''}</span>
                  <span className="iwr-chart__bar" style={{ height: `${(d.count / chartMax) * 120}px` }} />
                  <span className="iwr-muted">{formatViYmd(d.day).slice(0, 5)}</span>
                </div>
              ))}
            </div>
            <p className="iwr-muted">Lấy từ báo cáo ngày đã nộp trong kỳ{picked.length ? ` · đã gộp ${picked.length} ngày` : ''}.</p>
          </section>
        </div>

        <aside className="iwr-daily__side">
          <section className="iwr-card iwr-week__risks">
            <h2>Rủi ro &amp; quyết định cần hỗ trợ</h2>
            {blockers.map((it) => {
              const meta = parseIwrItemMeta(it.body);
              const sev = (meta.severity ?? 'medium') as IwrItemSeverity;
              return (
                <article key={it.id} className={`iwr-risk iwr-risk--${sev}`}>
                  <div className="iwr-risk__head">
                    <select
                      disabled={readOnly}
                      value={sev}
                      onChange={(e) => updateMeta(it, { severity: e.target.value as IwrItemSeverity })}
                    >
                      <option value="high">Cao</option>
                      <option value="medium">Trung bình</option>
                      <option value="low">Thấp</option>
                      <option value="critical">Khẩn</option>
                    </select>
                    {sev === 'high' || sev === 'critical' ? <span className="iwr-rag iwr-rag--red">Blocker</span> : null}
                  </div>
                  <input
                    className="iwr-ghost"
                    disabled={readOnly}
                    value={it.title}
                    onChange={(e) => replaceItem({ ...it, title: e.target.value })}
                  />
                  <div className="iwr-muted">
                    <input
                      className="iwr-ghost"
                      disabled={readOnly}
                      placeholder="Người xử lý"
                      value={meta.owner ?? ''}
                      onChange={(e) => updateMeta(it, { owner: e.target.value })}
                    />
                    <input
                      type="date"
                      className="iwr-input"
                      disabled={readOnly}
                      value={meta.due ?? ''}
                      onChange={(e) => updateMeta(it, { due: e.target.value })}
                    />
                  </div>
                  {it.section_key === 'blocked' && (
                    <button
                      type="button"
                      className="iwr-link"
                      data-testid="iwr-promote-risk"
                      onClick={() => void promoteIwrBlockerToRisk(token, report.id, it.id)}
                    >
                      Nâng rủi ro
                    </button>
                  )}
                  {!readOnly && (
                    <button type="button" className="iwr-iconbtn" onClick={() => void removeItem(it.id)}>
                      Xoá
                    </button>
                  )}
                </article>
              );
            })}
            {!readOnly && (
              <button type="button" className="iwr-add" onClick={() => void createItem('blocked')}>
                + Thêm rủi ro
              </button>
            )}
            <Link href="/crm/internal-reports/risks" className="iwr-link">
              Xem tất cả ({blockers.length}) →
            </Link>
          </section>

          <section className="iwr-card">
            <h2>Kế hoạch tuần tới</h2>
            {nextWeek.map((it) => {
              const meta = parseIwrItemMeta(it.body);
              return (
                <label key={it.id} className="iwr-plan">
                  <input
                    type="checkbox"
                    checked={Boolean(meta.checked)}
                    disabled={readOnly}
                    onChange={(e) => updateMeta(it, { checked: e.target.checked })}
                  />
                  <input
                    className="iwr-ghost"
                    disabled={readOnly}
                    value={it.title}
                    onChange={(e) => replaceItem({ ...it, title: e.target.value })}
                  />
                  {!readOnly && (
                    <button type="button" className="iwr-iconbtn" onClick={() => void removeItem(it.id)}>
                      Xoá
                    </button>
                  )}
                </label>
              );
            })}
            {!readOnly && (
              <button type="button" className="iwr-add" onClick={() => void createItem('next_week')}>
                + Thêm việc tuần tới
              </button>
            )}
            {!nextWeek.length && <p className="iwr-empty">Chưa có kế hoạch tuần tới</p>}
          </section>
        </aside>
      </div>

      <section className="iwr-card" style={{ marginTop: 16 }}>
        <h2>Phản hồi</h2>
        <ul className="iwr-comments">
          {comments.map((c) => (
            <li key={c.id}>
              <div className="iwr-muted">{new Date(c.created_at).toLocaleString('vi-VN')}</div>
              <div>{c.body_text}</div>
            </li>
          ))}
          {!comments.length && <li className="iwr-empty">Chưa có phản hồi</li>}
        </ul>
        {!IMMUTABLE.has(report.status) && (
          <div className="iwr-commentbox">
            <input
              className="iwr-input"
              placeholder="Viết phản hồi..."
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
            <button
              type="button"
              className="iwr-btn iwr-btn--primary"
              disabled={!commentBody.trim() || busy}
              onClick={() => {
                setBusy(true);
                void onAddComment({ body_text: commentBody.trim() })
                  .then(() => setCommentBody(''))
                  .finally(() => setBusy(false));
              }}
            >
              Gửi
            </button>
            {!isAuthor && commentBody.trim() && (
              <button
                type="button"
                className="iwr-btn"
                data-testid="iwr-reply-all"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  const run = onReplyAll ?? ((body) => replyAllIwrReport(token, report.id, body));
                  void run({ body_text: commentBody.trim() })
                    .then(() => setCommentBody(''))
                    .finally(() => setBusy(false));
                }}
              >
                Trả lời tất cả
              </button>
            )}
          </div>
        )}
      </section>

      {lateOpen && (
        <div className="iwr-modal">
          <div className="iwr-modal__box">
            <div className="iwr-mail__k">Nộp muộn — nhập lý do</div>
            <textarea className="iwr-input" value={lateReason} onChange={(e) => setLateReason(e.target.value)} />
            <div className="iwr-pagehead__actions">
              <button type="button" className="iwr-btn" onClick={() => setLateOpen(false)}>
                Huỷ
              </button>
              <button
                type="button"
                className="iwr-btn iwr-btn--primary"
                disabled={lateReason.trim().length < 3 || busy}
                onClick={() => void handleSubmit()}
              >
                Nộp
              </button>
            </div>
          </div>
        </div>
      )}

      {changeOpen && (
        <div className="iwr-modal">
          <div className="iwr-modal__box">
            <div className="iwr-mail__k">Yêu cầu bổ sung</div>
            <textarea className="iwr-input" value={changeBody} onChange={(e) => setChangeBody(e.target.value)} />
            <div className="iwr-pagehead__actions">
              <button type="button" className="iwr-btn" onClick={() => setChangeOpen(false)}>
                Huỷ
              </button>
              <button
                type="button"
                className="iwr-btn iwr-btn--primary"
                disabled={changeBody.trim().length < 3 || busy}
                onClick={() => {
                  setBusy(true);
                  void onRequestChanges({ body_text: changeBody.trim() })
                    .then(() => {
                      setChangeOpen(false);
                      setChangeBody('');
                    })
                    .finally(() => setBusy(false));
                }}
              >
                Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
