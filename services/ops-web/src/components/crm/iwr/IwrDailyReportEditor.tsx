'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  IWR_STATUS_LABELS,
  addIwrItem,
  deleteIwrItem,
  fetchIwrItems,
  fetchIwrSuggest,
  patchIwrItem,
  promoteIwrBlockerToRisk,
  replyAllIwrReport,
  uploadIwrFile,
  type IwrCommentRow,
  type IwrItemRow,
  type IwrReportDetail,
  type IwrReportStatus,
} from '@/lib/crm/iwr-api';
import { fetchStaffKpi, type StaffKpiGridEntry } from '@/lib/api';
import { iwrAvatarTone, iwrInitials } from './iwr-format';
import { IwrPeoplePicker, iwrInitialToChip, type IwrPersonChip } from './IwrPeoplePicker';
import { IwrB2bProjectSelect } from './IwrB2bProjectSelect';
import { iwrProjectMetaPatch } from './iwr-b2b-project';
import {
  clampProgress,
  formatViTime,
  formatViYmd,
  isOverdueYmd,
  iwrItemText,
  iwrKpiItemSeed,
  iwrKpiScore,
  iwrNormalizeEvidenceUrl,
  iwrTaskTitleInput,
  iwrTitleForKpi,
  iwrVisibleEvidenceUrl,
  parseIwrItemMeta,
  serializeIwrItemMeta,
  type IwrItemMeta,
  type IwrItemPriority,
  type IwrItemSeverity,
} from './iwr-item-meta';
import {
  DAILY_REPORT_TEMPLATES,
  FALLBACK_TIPS,
  ictCountdown,
  ictYmd,
  lockedTemplate,
  metricFieldsFor,
  reportTemplateForPosition,
  validateDailyReport,
  type DailyReportLine,
  type DailyReportMetrics,
  type DailyReportTemplateCode,
} from './daily-report-template';

type IwrDailyReportEditorProps = {
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
  positionCode?: string;
};

const IMMUTABLE = new Set<IwrReportStatus>(['acknowledged', 'waived', 'archived']);
const EDITABLE = new Set<IwrReportStatus>(['draft', 'changes_requested']);
const SUPPORT_ROLES = ['Account Manager', 'Team Lead', 'PM', 'Khác'];

function RoleLineFields({
  template,
  section,
  meta,
  readOnly,
  onMeta,
}: {
  template: DailyReportTemplateCode | null;
  section: 'done' | 'wip';
  meta: IwrItemMeta;
  readOnly: boolean;
  onMeta: (patch: Partial<IwrItemMeta>) => void;
}) {
  if (!template) return null;
  return (
    <div className="iwr-rolefields">
      {template === 'buyer_ads' && (
        <>
          <input
            className="iwr-input"
            disabled={readOnly}
            placeholder="Campaign"
            value={meta.campaign ?? ''}
            onChange={(e) => onMeta({ campaign: e.target.value })}
          />
          <input
            className="iwr-input"
            disabled={readOnly}
            placeholder="Ad account"
            value={meta.ad_account ?? ''}
            onChange={(e) => onMeta({ ad_account: e.target.value })}
          />
        </>
      )}
      {template === 'am_account' && (
        <>
          <input
            className="iwr-input"
            disabled={readOnly}
            placeholder="Account khách"
            value={meta.customer_account ?? ''}
            onChange={(e) => onMeta({ customer_account: e.target.value })}
          />
          <label className="iwr-check">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={Boolean(meta.meeting)}
              onChange={(e) => onMeta({ meeting: e.target.checked })}
            />
            Có lịch hẹn
          </label>
          {meta.meeting ? (
            <input
              className="iwr-input"
              disabled={readOnly}
              placeholder="Link lịch"
              value={meta.calendar_url ?? ''}
              onChange={(e) => onMeta({ calendar_url: e.target.value })}
            />
          ) : null}
        </>
      )}
      {template === 'content_edit' && section === 'done' && (
        <input
          className="iwr-input"
          disabled={readOnly}
          placeholder="Loại asset (ảnh, video, copy)"
          value={meta.asset_type ?? ''}
          onChange={(e) => onMeta({ asset_type: e.target.value })}
        />
      )}
      <label className="iwr-check">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={Boolean(meta.kpi_waived)}
          onChange={(e) => onMeta({ kpi_waived: e.target.checked })}
        />
        KPI không áp dụng
      </label>
      {meta.kpi_waived ? (
        <input
          className="iwr-input"
          disabled={readOnly}
          placeholder="Lý do không áp dụng, ít nhất 20 ký tự"
          value={meta.kpi_waive_reason ?? ''}
          onChange={(e) => onMeta({ kpi_waive_reason: e.target.value })}
        />
      ) : null}
    </div>
  );
}

function evidenceLabel(item: IwrItemRow, meta: IwrItemMeta): string {
  if (meta.evidence_name) return meta.evidence_name;
  const url = item.evidence_url ?? '';
  if (!url) return '';
  try {
    return decodeURIComponent(url.split('/').pop() || url);
  } catch {
    return url;
  }
}

function evidenceHref(item: IwrItemRow): string | null {
  const url = iwrVisibleEvidenceUrl(item.evidence_url);
  return url || null;
}

function metricText(value: unknown): string {
  if (value == null || value === '' || Number.isNaN(value)) return '';
  return String(value);
}

function metricNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

function lineFromItem(item: IwrItemRow): DailyReportLine | null {
  if (item.section_key !== 'done' && item.section_key !== 'wip' && item.section_key !== 'blocked' && item.section_key !== 'next') {
    return null;
  }
  const meta = parseIwrItemMeta(item.body);
  return {
    section: item.section_key,
    title: item.title ?? '',
    text: iwrItemText(meta),
    project: meta.project ?? '',
    kpi: meta.kpi_label || (meta.kpi_id != null ? String(meta.kpi_id) : ''),
    kpiWaived: Boolean(meta.kpi_waived),
    kpiWaiveReason: meta.kpi_waive_reason ?? '',
    progress: meta.progress == null ? null : Number(meta.progress),
    eta: meta.eta ?? '',
    evidenceUrl: item.evidence_url ?? '',
    evidenceName: meta.evidence_name ?? '',
    assetType: meta.asset_type ?? '',
    campaign: meta.campaign ?? '',
    adAccount: meta.ad_account ?? '',
    customerAccount: meta.customer_account ?? '',
    meeting: Boolean(meta.meeting),
    calendarUrl: meta.calendar_url ?? '',
  };
}

function KpiPick({
  rows,
  kpiId,
  kpiLabel,
  disabled,
  onChange,
}: {
  rows: StaffKpiGridEntry[] | null;
  kpiId?: number | null;
  kpiLabel?: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const selected = (rows ?? []).find((row) => row.id === kpiId);
  const missing = kpiId != null && kpiId > 0 && !selected;
  return (
    <span className="iwr-kpi">
      <select
        aria-label="KPI"
        disabled={disabled || rows == null}
        title={rows != null && rows.length === 0 ? 'Chưa có KPI của người viết trong tháng này' : 'KPI tháng của người viết báo cáo'}
        value={kpiId != null && kpiId > 0 ? String(kpiId) : ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{rows == null ? 'Đang tải KPI…' : '— Chọn KPI —'}</option>
        {missing && <option value={String(kpiId)}>{kpiLabel || `KPI #${kpiId}`}</option>}
        {(rows ?? []).map((row) => (
          <option key={row.id} value={String(row.id)}>
            {row.metric_name}
          </option>
        ))}
      </select>
      {selected && <span className="iwr-muted">{iwrKpiScore(selected)}</span>}
    </span>
  );
}

function EvidenceUrlField({
  url,
  disabled,
  onCommit,
}: {
  url: string | null;
  disabled?: boolean;
  onCommit: (next: string) => void;
}) {
  const external = iwrVisibleEvidenceUrl(url);
  const [draft, setDraft] = useState(external);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(external);
  }, [external]);

  return (
    <label className="iwr-task__url">
      <span className="iwr-muted">URL bằng chứng</span>
      <input
        className="iwr-input"
        disabled={disabled}
        placeholder="Dán link, ví dụ https://..."
        value={draft}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          const next = iwrNormalizeEvidenceUrl(draft);
          setDraft(next);
          if (next !== external) onCommit(next);
        }}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          onCommit(next);
        }}
      />
    </label>
  );
}

export function IwrDailyReportEditor({
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
  positionCode,
}: IwrDailyReportEditorProps) {
  const isAuthor = report.viewer_is_author !== false;
  const isReviewer = Boolean(report.viewer_is_reviewer);
  const readOnly = IMMUTABLE.has(report.status) || !isAuthor || !EDITABLE.has(report.status);
  const toRecipient = report.recipients.find((r) => r.kind === 'to');
  const ccRecipients = report.recipients.filter((r) => r.kind === 'cc');
  const [items, setItems] = useState<IwrItemRow[]>(report.items ?? []);
  const [suggestHits, setSuggestHits] = useState<{ kind: string; id: string; label: string }[]>([]);
  const [title, setTitle] = useState(() => {
    if (/^Báo cáo ngày \d{4}-\d{2}-\d{2}$/.test(report.title) && report.author_name) {
      return `Báo cáo ngày — ${report.author_name} — ${formatViYmd(report.period_start)}`;
    }
    return report.title;
  });
  const [toPerson, setToPerson] = useState<IwrPersonChip | null>(() =>
    iwrInitialToChip(report.id, toRecipient, readOnly),
  );
  const [ccPeople, setCcPeople] = useState<IwrPersonChip[]>(
    ccRecipients.map((r) => ({ id: r.staff_id, name: r.staff_name ?? `#${r.staff_id}` })),
  );
  const [bccPeople, setBccPeople] = useState<IwrPersonChip[]>(
    report.recipients
      .filter((r) => r.kind === 'bcc')
      .map((r) => ({ id: r.staff_id, name: r.staff_name ?? `#${r.staff_id}` })),
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState(false);
  const [lateOpen, setLateOpen] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeBody, setChangeBody] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [formError, setFormError] = useState('');
  const notesBody = (() => {
    const notes = report.sections_json?.notes;
    if (notes && typeof notes === 'object' && 'body' in notes) return String((notes as { body?: string }).body ?? '');
    return '';
  })();
  const [summary, setSummary] = useState(notesBody);
  const storedMetrics = (() => {
    const role = report.sections_json?.daily_role;
    if (!role || typeof role !== 'object' || !('metrics' in role)) return {};
    return ((role as { metrics?: Record<string, unknown> }).metrics ?? {}) as Record<string, unknown>;
  })();
  const [metrics, setMetrics] = useState({
    ad_spend_vnd: metricText(storedMetrics.ad_spend_vnd),
    crm_spend_vnd: metricText(storedMetrics.crm_spend_vnd),
    spend_note: String(storedMetrics.spend_note ?? ''),
    new_leads: metricText(storedMetrics.new_leads),
    calls_within_15: metricText(storedMetrics.calls_within_15),
    sla_pct: metricText(storedMetrics.sla_pct),
    new_appointments: metricText(storedMetrics.new_appointments),
  });
  const [clock, setClock] = useState(() => new Date());
  const itemTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetchIwrItems(token, report.id)
      .then((out) => setItems(out.items ?? []))
      .catch(() => undefined);
    void fetchIwrSuggest(token, report.id)
      .then((out) => setSuggestHits(out.items ?? []))
      .catch(() => undefined);
  }, [token, report.id]);

  const [kpiRows, setKpiRows] = useState<StaffKpiGridEntry[] | null>(null);
  useEffect(() => {
    const [year, month] = report.period_start.split('-').map((part) => Number(part));
    if (!year || !month || !report.author_staff_id) {
      setKpiRows([]);
      return;
    }
    let cancelled = false;
    void fetchStaffKpi(token, { year, month, staff_id: report.author_staff_id })
      .then((rows) => {
        if (!cancelled) setKpiRows(rows);
      })
      .catch(() => {
        if (!cancelled) setKpiRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, report.period_start, report.author_staff_id]);

  useEffect(() => {
    setTitle(report.title);
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
    if (report.items?.length) setItems(report.items);
  }, [report]);

  const doneItems = items.filter((it) => it.section_key === 'done');
  const wipItems = items.filter((it) => it.section_key === 'wip');
  const nextItems = items.filter((it) => it.section_key === 'next');
  const blockedItems = items.filter((it) => it.section_key === 'blocked');
  const snapshotTemplate = lockedTemplate(report.sections_json);
  const positionTemplate = reportTemplateForPosition(positionCode);
  const reportTemplate = snapshotTemplate ?? positionTemplate;
  const templateLabel = reportTemplate ? DAILY_REPORT_TEMPLATES[reportTemplate].label : 'Chưa gán mẫu';
  const tips = reportTemplate ? DAILY_REPORT_TEMPLATES[reportTemplate].tips : FALLBACK_TIPS;
  const slaEnabled = Boolean(
    report.sections_json?.daily_role &&
      typeof report.sections_json.daily_role === 'object' &&
      (report.sections_json.daily_role as { sla_enabled?: boolean }).sla_enabled,
  );
  const metricFields = metricFieldsFor(reportTemplate, slaEnabled);
  const countdown = ictCountdown(clock);
  const templateDrift = Boolean(snapshotTemplate && positionTemplate && snapshotTemplate !== positionTemplate);
  const overdueCount = items.filter((it) => {
    const meta = parseIwrItemMeta(it.body);
    return it.section_key !== 'next' && isOverdueYmd(meta.eta ?? meta.due) && clampProgress(meta.progress) < 100;
  }).length;

  const buildSections = useCallback(
    (rows: IwrItemRow[]) => {
      const of = (key: string) => rows.filter((it) => it.section_key === key);
      const line = (it: IwrItemRow) => {
        const meta = parseIwrItemMeta(it.body);
        return [it.title, meta.project, iwrItemText(meta)].filter(Boolean).join(' — ');
      };
      const blocked = of('blocked').map((it) => {
        const meta = parseIwrItemMeta(it.body);
        return {
          title: it.title,
          description: iwrItemText(meta),
          severity: meta.severity ?? 'medium',
        };
      });
      const prevRole =
        report.sections_json?.daily_role && typeof report.sections_json.daily_role === 'object'
          ? (report.sections_json.daily_role as Record<string, unknown>)
          : {};
      return {
        ...(report.sections_json ?? {}),
        done: { body: of('done').map(line).join('\n'), items: [] },
        wip: { body: of('wip').map(line).join('\n'), items: [] },
        next: { body: of('next').map(line).join('\n'), items: [] },
        blocked: { body: blocked.map((b) => b.title).join('\n'), items: blocked },
        notes: { body: summary, items: [] },
        daily_role: {
          ...prevRole,
          metrics: {
            ad_spend_vnd: metricNumber(metrics.ad_spend_vnd),
            crm_spend_vnd: metricNumber(metrics.crm_spend_vnd),
            spend_note: metrics.spend_note,
            new_leads: metricNumber(metrics.new_leads),
            calls_within_15: metricNumber(metrics.calls_within_15),
            sla_pct: metricNumber(metrics.sla_pct),
            new_appointments: metricNumber(metrics.new_appointments),
          },
        },
      };
    },
    [report.sections_json, summary, metrics],
  );

  const persistDraft = useCallback(
    async (
      nextTitle = title,
      nextCc = ccPeople.map((p) => p.id),
      nextItems = items,
      nextTo: number | null | undefined = toPerson?.id,
    ) => {
      if (readOnly) return;
      setSaveState('saving');
      try {
        await onPatch({
          title: nextTitle.trim() || report.title,
          sections_json: buildSections(nextItems),
          to_staff_id: nextTo ?? null,
          cc_staff_ids: nextCc,
        });
        setSavedAt(new Date());
        setSaveState('saved');
      } catch (err) {
        setSaveState('error');
        setFormError(err instanceof Error ? err.message : 'Lưu nháp thất bại');
      }
    },
    [readOnly, onPatch, title, ccPeople, items, toPerson, report.title, buildSections],
  );

  const clearedDefaultTo = useRef(false);
  useEffect(() => {
    if (readOnly || clearedDefaultTo.current || toPerson || !toRecipient) return;
    clearedDefaultTo.current = true;
    void persistDraft(title, ccPeople.map((p) => p.id), items, null);
  }, [readOnly, toPerson, toRecipient, persistDraft, title, ccPeople, items]);

  const scheduleDraft = useCallback(
    (
      nextTitle = title,
      nextCc = ccPeople.map((p) => p.id),
      nextItems = items,
      nextTo: number | null | undefined = toPerson?.id,
    ) => {
      if (readOnly) return;
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(() => {
        void persistDraft(nextTitle, nextCc, nextItems, nextTo);
      }, 700);
    },
    [readOnly, persistDraft, title, ccPeople, items, toPerson],
  );

  const summaryReady = useRef(false);
  useEffect(() => {
    if (!summaryReady.current) {
      summaryReady.current = true;
      return;
    }
    scheduleDraft();
  }, [summary, metrics]);

  const scheduleItemPatch = useCallback(
    (row: IwrItemRow) => {
      if (readOnly) return;
      if (itemTimers.current[row.id]) clearTimeout(itemTimers.current[row.id]);
      itemTimers.current[row.id] = setTimeout(() => {
        void patchIwrItem(token, report.id, row.id, {
          title: row.title,
          body: row.body,
          section_key: row.section_key,
          evidence_url: row.evidence_url,
          ref_kind: row.ref_kind,
          ref_id: row.ref_id,
          sort_order: row.sort_order,
        })
          .then(() => {
            setSavedAt(new Date());
            setSaveState('saved');
          })
          .catch((err) => {
            setSaveState('error');
            setFormError(err instanceof Error ? err.message : 'Lưu dòng thất bại');
          });
      }, 450);
    },
    [readOnly, token, report.id],
  );

  function replaceItem(next: IwrItemRow, persist = true) {
    setItems((prev) => {
      const rows = prev.map((it) => (it.id === next.id ? next : it));
      if (persist) scheduleDraft(title, ccPeople.map((p) => p.id), rows);
      return rows;
    });
    if (persist) scheduleItemPatch(next);
  }

  function updateMeta(row: IwrItemRow, patch: Partial<IwrItemMeta>, extra?: Partial<IwrItemRow>) {
    const meta = { ...parseIwrItemMeta(row.body), ...patch };
    replaceItem({ ...row, ...extra, body: serializeIwrItemMeta(meta) });
  }

  function applyKpi(row: IwrItemRow, kpiId: string) {
    const hit = (kpiRows ?? []).find((entry) => String(entry.id) === kpiId);
    if (!hit) {
      updateMeta(row, { kpi_id: null, kpi_label: '' });
      return;
    }
    const seed = iwrKpiItemSeed(hit);
    const title = iwrTitleForKpi(row.title, hit.metric_name);
    updateMeta(
      row,
      { ...parseIwrItemMeta(seed.body), kpi_id: hit.id, kpi_label: hit.metric_name },
      { title, section_key: seed.section },
    );
  }

  async function pourKpi() {
    if (readOnly) return;
    const source = kpiRows ?? [];
    if (!source.length) {
      setFormError('Không có KPI của người viết trong tháng này.');
      return;
    }
    const linked = new Set(
      items
        .map((it) => parseIwrItemMeta(it.body).kpi_id)
        .filter((id): id is number => id != null && id > 0),
    );
    const pending = source.filter((row) => !linked.has(row.id));
    if (!pending.length) {
      setFormError('KPI tháng này đã có trên báo cáo.');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      let next = [...items];
      const blanks = next.filter((it) => {
        if (it.section_key !== 'done' && it.section_key !== 'wip') return false;
        const meta = parseIwrItemMeta(it.body);
        return !(meta.kpi_id != null && meta.kpi_id > 0) && !iwrTaskTitleInput(it.title).trim();
      });
      const used = new Set<string>();
      for (const row of pending) {
        const seed = iwrKpiItemSeed(row);
        const blank =
          blanks.find((it) => !used.has(it.id) && it.section_key === seed.section) ??
          blanks.find((it) => !used.has(it.id));
        if (blank) {
          used.add(blank.id);
          const patched = await patchIwrItem(token, report.id, blank.id, {
            section_key: seed.section,
            title: seed.title,
            body: seed.body,
          });
          next = next.map((it) => (it.id === blank.id ? { ...patched, body: seed.body } : it));
          continue;
        }
        const created = await addIwrItem(token, report.id, {
          section_key: seed.section,
          title: seed.title,
          body: seed.body,
          ref_kind: 'none',
          ref_id: null,
          evidence_url: null,
          sort_order: next.filter((it) => it.section_key === seed.section).length,
        });
        next = [...next, { ...created, body: created.body || seed.body }];
      }
      setItems(next);
      scheduleDraft(title, ccPeople.map((p) => p.id), next);
      setSavedAt(new Date());
      setSaveState('saved');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Đổ KPI thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function createItem(section: 'done' | 'wip' | 'next' | 'blocked', seed?: Partial<IwrItemRow>) {
    if (readOnly) return;
    setBusy(true);
    setFormError('');
    try {
      const defaults: Record<string, IwrItemMeta> = {
        done: { b2b_project_id: '', project: '', progress: 100 },
        wip: { b2b_project_id: '', project: '', progress: 40, eta: '' },
        next: { b2b_project_id: '', project: '', priority: 'medium' },
        blocked: { severity: 'high', support: 'Account Manager', due: '', note: '' },
      };
      const row = await addIwrItem(token, report.id, {
        section_key: section,
        title: seed?.title ?? (section === 'blocked' ? 'Blocker mới' : 'Công việc mới'),
        body: seed?.body ?? serializeIwrItemMeta(defaults[section]),
        ref_kind: seed?.ref_kind ?? 'none',
        ref_id: seed?.ref_id ?? null,
        evidence_url: seed?.evidence_url ?? null,
        sort_order: items.filter((it) => it.section_key === section).length,
      });
      setItems((prev) => {
        const rows = [...prev, row];
        scheduleDraft(title, ccPeople.map((p) => p.id), rows);
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
    try {
      await deleteIwrItem(token, report.id, id);
      setItems((prev) => {
        const rows = prev.filter((it) => it.id !== id);
        scheduleDraft(title, ccPeople.map((p) => p.id), rows);
        return rows;
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Xoá dòng thất bại');
    }
  }

  async function moveSection(row: IwrItemRow, section: IwrItemRow['section_key']) {
    const next = { ...row, section_key: section };
    replaceItem(next);
  }

  async function attachEvidence(row: IwrItemRow, file: File) {
    setBusy(true);
    setFormError('');
    try {
      const uploaded = await uploadIwrFile(token, report.id, file);
      updateMeta(row, { evidence_name: uploaded.file_name }, { evidence_url: uploaded.file_name });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Tải file thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    const metricsPayload: DailyReportMetrics = {
      adSpendVnd: metricNumber(metrics.ad_spend_vnd),
      crmSpendVnd: metricNumber(metrics.crm_spend_vnd),
      spendNote: metrics.spend_note,
      newLeads: metricNumber(metrics.new_leads),
      callsWithin15: metricNumber(metrics.calls_within_15),
      slaPct: metricNumber(metrics.sla_pct),
      newAppointments: metricNumber(metrics.new_appointments),
    };
    const issues = validateDailyReport({
      template: reportTemplate,
      subject: title,
      reportDate: String(report.period_start).slice(0, 10),
      todayYmd: ictYmd(clock),
      toStaffId: toPerson?.id ?? null,
      toActive: Boolean(toPerson),
      summary,
      slaEnabled,
      slaThresholdPct: 80,
      duplicateSubmitted: false,
      lines: items.map(lineFromItem).filter((line): line is DailyReportLine => line != null),
      metrics: metricsPayload,
    });
    if (issues.length) {
      setFormError(issues.map((issue) => issue.message).join(' '));
      return;
    }
    const due = new Date(report.due_at).getTime();
    const deadline = new Date(`${String(report.period_end || report.period_start).slice(0, 10)}T22:00:00.000+07:00`).getTime();
    if ((Number.isFinite(deadline) ? Date.now() > deadline : Date.now() > due) && !lateReason.trim()) {
      setLateOpen(true);
      return;
    }
    if (!window.confirm('Gửi báo cáo ngày? Sau khi gửi, nội dung khóa và chỉ thêm phản hồi.')) return;
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

  const draftIssues = validateDailyReport({
    template: reportTemplate,
    subject: title,
    reportDate: String(report.period_start).slice(0, 10),
    todayYmd: ictYmd(clock),
    toStaffId: toPerson?.id ?? null,
    toActive: Boolean(toPerson),
    summary,
    slaEnabled,
    slaThresholdPct: 80,
    duplicateSubmitted: false,
    lines: items.map(lineFromItem).filter((line): line is DailyReportLine => line != null),
    metrics: {
      adSpendVnd: metricNumber(metrics.ad_spend_vnd),
      crmSpendVnd: metricNumber(metrics.crm_spend_vnd),
      spendNote: metrics.spend_note,
      newLeads: metricNumber(metrics.new_leads),
      callsWithin15: metricNumber(metrics.calls_within_15),
      slaPct: metricNumber(metrics.sla_pct),
      newAppointments: metricNumber(metrics.new_appointments),
    },
  });
  const readyToSend = draftIssues.length === 0;
  const projectCount = new Set(
    items
      .filter((it) => it.section_key === 'done' || it.section_key === 'wip')
      .map((it) => parseIwrItemMeta(it.body).b2b_project_id || parseIwrItemMeta(it.body).project)
      .filter(Boolean),
  ).size;

  const statusLabel =
    report.status === 'draft' ? 'Bản nháp' : IWR_STATUS_LABELS[report.status] ?? report.status;
  const savedLabel =
    saveState === 'saving'
      ? 'Đang lưu…'
      : savedAt
        ? `Đã lưu ${formatViTime(savedAt)}`
        : report.first_viewed_at
          ? 'Đã xem'
          : 'Chưa lưu trên máy';

  const primaryBlocker = blockedItems[0] ?? null;
  const primaryMeta = primaryBlocker ? parseIwrItemMeta(primaryBlocker.body) : null;

  return (
    <div className="iwr-daily">
      <div className="iwr-crumb">
        <Link href="/crm/internal-reports">Báo cáo công việc</Link>
        <span>/</span>
        <Link href="/crm/internal-reports?kind=daily">Báo cáo ngày</Link>
      </div>

      <div className="iwr-daily__head">
        <div>
          <h1 className="iwr-h1">
            Báo cáo ngày — {formatViYmd(report.period_start) || report.period_start}
            <span className={`iwr-chip iwr-chip--status iwr-chip--${report.status}`}>{statusLabel}</span>
            <span className="iwr-chip iwr-chip--template">Mẫu: {templateLabel}</span>
            {report.first_viewed_at ? <span className="iwr-chip">Đã xem</span> : null}
            {comments.length > 0 ? <span className="iwr-chip">Có phản hồi</span> : null}
            {(report.is_late || (countdown.late && EDITABLE.has(report.status))) ? (
              <span className="iwr-chip iwr-chip--late">Quá hạn</span>
            ) : null}
          </h1>
          <p className="iwr-saved">
            <span className="iwr-saved__ok" aria-hidden>
              ✓
            </span>
            {savedLabel}
            {report.first_viewed_at ? (
              <span data-testid="iwr-viewed" className="iwr-saved__viewed">
                Đã xem
              </span>
            ) : null}
          </p>
        </div>
        <div className="iwr-pagehead__actions">
          {isAuthor && canWrite && EDITABLE.has(report.status) && (
            <>
              <button
                type="button"
                className="iwr-btn"
                disabled={busy || readOnly}
                onClick={() => void persistDraft()}
              >
                Lưu nháp
              </button>
              <button
                type="button"
                className="iwr-btn iwr-btn--primary"
                aria-label="Nộp"
                disabled={busy}
                onClick={() => void handleSubmit()}
              >
                Gửi báo cáo
              </button>
            </>
          )}
          {isAuthor && (report.status === 'submitted' || report.status === 'supplemented') && canWrite && (
            <button
              type="button"
              className="iwr-btn"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void onWithdraw().finally(() => setBusy(false));
              }}
            >
              Rút
            </button>
          )}
          {canReview && isReviewer && (report.status === 'submitted' || report.status === 'supplemented') && (
            <>
              <button
                type="button"
                className="iwr-btn iwr-btn--primary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void onAck().finally(() => setBusy(false));
                }}
              >
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
            scheduleDraft(title, ccPeople.map((p) => p.id), items, person?.id);
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
            scheduleDraft(title, next.map((p) => p.id), items);
          }}
          disabled={readOnly}
        />
        <div className="iwr-mail__cell iwr-mail__cell--grow">
          <div className="iwr-mail__k">Chủ đề</div>
          <input
            className="iwr-input"
            disabled={readOnly}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleDraft(e.target.value, ccPeople.map((p) => p.id), items);
            }}
          />
        </div>
        <div className="iwr-mail__privacy">
          <span aria-hidden>🛡</span>
          Chỉ người nhận có quyền mới xem được
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

      {suggestHits.length > 0 && !readOnly && (
        <div className="iwr-card iwr-daily__suggest" data-testid="iwr-suggest">
          <div className="iwr-mail__k">Gợi ý hôm nay</div>
          <div className="iwr-suggest-row">
            {suggestHits.map((hit) => (
              <button
                key={`${hit.kind}-${hit.id}`}
                type="button"
                className="iwr-btn"
                onClick={() =>
                  void createItem('done', {
                    title: hit.label,
                    ref_kind: hit.kind as IwrItemRow['ref_kind'],
                    ref_id: hit.id,
                    body: serializeIwrItemMeta({ b2b_project_id: '', project: '', progress: 100 }),
                  })
                }
              >
                + {hit.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="iwr-daily__grid">
        <div className="iwr-daily__main">
          <section className="iwr-card">
            <div className="iwr-section__head">
              <h2>Kết quả đã hoàn thành</h2>
              {!readOnly && (
                <button type="button" className="iwr-btn" disabled={busy || kpiRows == null} onClick={() => void pourKpi()}>
                  Đổ KPI vào
                </button>
              )}
            </div>
            {doneItems.map((it, idx) => {
              const meta = parseIwrItemMeta(it.body);
              const file = evidenceLabel(it, meta);
              const href = evidenceHref(it);
              return (
                <article key={it.id} className="iwr-task">
                  <div className="iwr-task__head">
                    <label className="iwr-check">
                      <input
                        type="checkbox"
                        checked
                        disabled={readOnly}
                        onChange={() => void moveSection(it, 'wip')}
                      />
                      <span>{idx + 1}.</span>
                    </label>
                    <input
                      className="iwr-input iwr-task__title"
                      disabled={readOnly}
                      placeholder="Tên công việc"
                      value={iwrTaskTitleInput(it.title)}
                      onChange={(e) => replaceItem({ ...it, title: e.target.value })}
                    />
                    {!readOnly && (
                      <button type="button" className="iwr-iconbtn" onClick={() => void removeItem(it.id)}>
                        Xoá
                      </button>
                    )}
                  </div>
                  <div className="iwr-task__meta">
                    <IwrB2bProjectSelect
                      token={token}
                      disabled={readOnly}
                      value={meta.b2b_project_id ?? ''}
                      onChange={(_, project) => updateMeta(it, iwrProjectMetaPatch(project))}
                    />
                    <ProgressField
                      value={clampProgress(meta.progress ?? 100)}
                      disabled={readOnly}
                      onChange={(n) => updateMeta(it, { progress: n })}
                    />
                    <KpiPick
                      rows={kpiRows}
                      kpiId={meta.kpi_id}
                      kpiLabel={meta.kpi_label}
                      disabled={readOnly}
                      onChange={(id) => applyKpi(it, id)}
                    />
                    <div className="iwr-evidence">
                      {file && !href ? <span>{file}</span> : <span className="iwr-muted">Chưa có file</span>}
                      {!readOnly && (
                        <label className="iwr-link">
                          + File
                          <input
                            type="file"
                            hidden
                            onChange={(e) => {
                              const fileObj = e.target.files?.[0];
                              if (fileObj) void attachEvidence(it, fileObj);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                    {it.ref_kind !== 'none' && <span className="iwr-muted">{it.ref_kind}</span>}
                  </div>
                  {readOnly && href ? (
                    <a href={href} target="_blank" rel="noreferrer" className="iwr-link iwr-task__url-link">
                      {href}
                    </a>
                  ) : (
                    <EvidenceUrlField
                      url={it.evidence_url}
                      disabled={readOnly}
                      onCommit={(next) =>
                        updateMeta(it, { evidence_name: next ? '' : meta.evidence_name }, { evidence_url: next || null })
                      }
                    />
                  )}
                  <textarea
                    className="iwr-input iwr-task__desc"
                    disabled={readOnly}
                    placeholder="Mô tả (ít nhất 20 ký tự)"
                    value={iwrItemText(meta)}
                    onChange={(e) => updateMeta(it, { text: e.target.value })}
                  />
                  <RoleLineFields
                    template={reportTemplate}
                    section="done"
                    meta={meta}
                    readOnly={readOnly}
                    onMeta={(patch) => updateMeta(it, patch)}
                  />
                </article>
              );
            })}
            {!readOnly && (
              <button type="button" className="iwr-add" disabled={busy} onClick={() => void createItem('done')}>
                + Thêm kết quả
              </button>
            )}
            {!doneItems.length && <p className="iwr-empty">Chưa có việc hoàn thành</p>}
          </section>

          <section className="iwr-card">
            <h2>Đang thực hiện</h2>
            <table className="iwr-table">
              <thead>
                <tr>
                  <th>Công việc</th>
                  <th>Dự án</th>
                  <th>KPI</th>
                  <th>Tiến độ</th>
                  <th>ETA</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {wipItems.map((it) => {
                  const meta = parseIwrItemMeta(it.body);
                  return (
                    <tr key={it.id}>
                      <td>
                        <input
                          className="iwr-ghost"
                          disabled={readOnly}
                          value={it.title}
                          onChange={(e) => replaceItem({ ...it, title: e.target.value })}
                        />
                        <textarea
                          className="iwr-input iwr-task__desc"
                          disabled={readOnly}
                          placeholder="Mô tả (ít nhất 20 ký tự)"
                          value={iwrItemText(meta)}
                          onChange={(e) => updateMeta(it, { text: e.target.value })}
                        />
                        <RoleLineFields
                          template={reportTemplate}
                          section="wip"
                          meta={meta}
                          readOnly={readOnly}
                          onMeta={(patch) => updateMeta(it, patch)}
                        />
                      </td>
                      <td>
                        <IwrB2bProjectSelect
                          token={token}
                          disabled={readOnly}
                          value={meta.b2b_project_id ?? ''}
                          onChange={(_, project) => updateMeta(it, iwrProjectMetaPatch(project))}
                        />
                      </td>
                      <td>
                        <KpiPick
                          rows={kpiRows}
                          kpiId={meta.kpi_id}
                          kpiLabel={meta.kpi_label}
                          disabled={readOnly}
                          onChange={(id) => applyKpi(it, id)}
                        />
                      </td>
                      <td>
                        <ProgressField
                          value={clampProgress(meta.progress ?? 0)}
                          disabled={readOnly}
                          onChange={(n) => updateMeta(it, { progress: n })}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="iwr-input"
                          disabled={readOnly}
                          value={meta.eta ?? ''}
                          onChange={(e) => updateMeta(it, { eta: e.target.value })}
                        />
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
                {!wipItems.length && (
                  <tr>
                    <td colSpan={6} className="iwr-empty">
                      Không có việc đang làm
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {!readOnly && (
              <button type="button" className="iwr-add" disabled={busy} onClick={() => void createItem('wip')}>
                + Thêm việc đang làm
              </button>
            )}
          </section>

          <section className="iwr-card">
            <h2>Kế hoạch ngày mai</h2>
            {nextItems.map((it) => {
              const meta = parseIwrItemMeta(it.body);
              const priority = (meta.priority ?? 'medium') as IwrItemPriority;
              return (
                <article key={it.id} className="iwr-plan">
                  <input
                    type="checkbox"
                    checked={Boolean(meta.checked)}
                    disabled={readOnly}
                    onChange={(e) => updateMeta(it, { checked: e.target.checked })}
                  />
                  <select
                    className={`iwr-pri iwr-pri--${priority}`}
                    disabled={readOnly}
                    value={priority}
                    onChange={(e) => updateMeta(it, { priority: e.target.value as IwrItemPriority })}
                  >
                    <option value="high">Cao</option>
                    <option value="medium">Trung bình</option>
                    <option value="low">Thấp</option>
                  </select>
                  <input
                    className="iwr-ghost"
                    disabled={readOnly}
                    value={it.title}
                    onChange={(e) => replaceItem({ ...it, title: e.target.value })}
                  />
                  <IwrB2bProjectSelect
                    token={token}
                    disabled={readOnly}
                    value={meta.b2b_project_id ?? ''}
                    onChange={(_, project) => updateMeta(it, iwrProjectMetaPatch(project))}
                  />
                  {!readOnly && (
                    <button type="button" className="iwr-iconbtn" onClick={() => void removeItem(it.id)}>
                      Xoá
                    </button>
                  )}
                </article>
              );
            })}
            {!readOnly && (
              <button type="button" className="iwr-add" disabled={busy} onClick={() => void createItem('next')}>
                + Thêm kế hoạch
              </button>
            )}
            {!nextItems.length && <p className="iwr-empty">Chưa có kế hoạch ngày mai</p>}
          </section>

          <section className="iwr-card">
            <h2>Tóm tắt</h2>
            <p className="iwr-muted">Gợi ý theo mẫu, không ghi vào nội dung khi gửi.</p>
            <ol className="iwr-tips">
              {tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ol>
            <textarea
              className="iwr-input iwr-summary-input"
              disabled={readOnly}
              placeholder={reportTemplate === 'ql_gdkd' ? 'Tóm tắt điều hành, ít nhất 30 ký tự' : 'Tóm tắt hôm nay, ít nhất 40 ký tự'}
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                scheduleDraft();
              }}
            />
          </section>

          {metricFields.required.length + metricFields.optional.length > 0 && (
            <section className="iwr-card">
              <h2>Số liệu hôm nay</h2>
              <p className="iwr-muted">CRM chưa nối — nhập tay. [cần xác nhận] nguồn số liệu.</p>
              {metricFields.required.includes('ad_spend') || metricFields.optional.includes('ad_spend') ? (
                <label className="iwr-field">
                  Chi tiêu ads (VND){metricFields.required.includes('ad_spend') ? ' *' : ''}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    disabled={readOnly}
                    value={metrics.ad_spend_vnd}
                    onChange={(e) => {
                      setMetrics((prev) => ({ ...prev, ad_spend_vnd: e.target.value }));
                      scheduleDraft();
                    }}
                  />
                </label>
              ) : null}
              {reportTemplate === 'buyer_ads' ? (
                <>
                  <label className="iwr-field">
                    Chi tiêu CRM (nếu có)
                    <input
                      type="number"
                      min={0}
                      step={1}
                      disabled={readOnly}
                      value={metrics.crm_spend_vnd}
                      onChange={(e) => {
                        setMetrics((prev) => ({ ...prev, crm_spend_vnd: e.target.value }));
                        scheduleDraft();
                      }}
                    />
                  </label>
                  <label className="iwr-field">
                    Chú thích lệch CRM
                    <input
                      disabled={readOnly}
                      value={metrics.spend_note}
                      onChange={(e) => {
                        setMetrics((prev) => ({ ...prev, spend_note: e.target.value }));
                        scheduleDraft();
                      }}
                    />
                  </label>
                </>
              ) : null}
              {metricFields.required.includes('new_leads') || metricFields.optional.includes('new_leads') ? (
                <label className="iwr-field">
                  Lead mới{metricFields.required.includes('new_leads') ? ' *' : ''}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    disabled={readOnly}
                    value={metrics.new_leads}
                    onChange={(e) => {
                      setMetrics((prev) => ({ ...prev, new_leads: e.target.value }));
                      scheduleDraft();
                    }}
                  />
                </label>
              ) : null}
              {metricFields.required.includes('calls_within_15') || metricFields.optional.includes('calls_within_15') ? (
                <label className="iwr-field">
                  Gọi trong 15 phút{metricFields.required.includes('calls_within_15') ? ' *' : ''}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    disabled={readOnly}
                    value={metrics.calls_within_15}
                    onChange={(e) => {
                      setMetrics((prev) => ({ ...prev, calls_within_15: e.target.value }));
                      scheduleDraft();
                    }}
                  />
                </label>
              ) : null}
              {metricFields.required.includes('sla_pct') || metricFields.optional.includes('sla_pct') ? (
                <label className="iwr-field">
                  SLA %{metricFields.required.includes('sla_pct') ? ' *' : ''}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    disabled={readOnly}
                    value={metrics.sla_pct}
                    onChange={(e) => {
                      setMetrics((prev) => ({ ...prev, sla_pct: e.target.value }));
                      scheduleDraft();
                    }}
                  />
                </label>
              ) : null}
              {metricFields.required.includes('new_appointments') || metricFields.optional.includes('new_appointments') ? (
                <label className="iwr-field">
                  Lịch hẹn mới
                  <input
                    type="number"
                    min={0}
                    step={1}
                    disabled={readOnly}
                    value={metrics.new_appointments}
                    onChange={(e) => {
                      setMetrics((prev) => ({ ...prev, new_appointments: e.target.value }));
                      scheduleDraft();
                    }}
                  />
                </label>
              ) : null}
              {reportTemplate === 'cskh_sales' && !slaEnabled ? (
                <p className="iwr-muted">SLA đang tắt. Admin bật cho team thì mới bắt buộc gọi và SLA. [cần xác nhận]</p>
              ) : null}
            </section>
          )}
        </div>

        <aside className="iwr-daily__side">
          <section className="iwr-card">
            <h2>Tóm tắt hôm nay</h2>
            <ul className="iwr-summary">
              <li>
                <span className="iwr-summary__ico is-ok">✓</span>
                {doneItems.length} Task hoàn thành
              </li>
              <li>
                <span className="iwr-summary__ico is-late">⏱</span>
                {overdueCount} Task quá hạn
              </li>
              <li>
                <span className="iwr-summary__ico is-risk">▲</span>
                {blockedItems.length} Blocker
              </li>
              <li>Mẫu: {templateLabel}</li>
              <li>Blocker: {blockedItems.length ? 'Có' : 'Không'}</li>
              <li>Dự án chạm: {projectCount}</li>
              <li>{readyToSend ? 'Sẵn sàng gửi' : 'Nháp — chưa đủ'}</li>
              <li>{countdown.late ? 'Quá hạn 22:00 ICT' : countdown.label}</li>
              {reportTemplate === 'buyer_ads' ? <li>Chi tiêu: {metrics.ad_spend_vnd || '—'}</li> : null}
              {reportTemplate === 'am_account' || reportTemplate === 'cskh_sales' ? (
                <li>Lead mới: {metrics.new_leads || '—'}</li>
              ) : null}
              {reportTemplate === 'content_edit' ? <li>Asset hoàn thành: {doneItems.length}</li> : null}
            </ul>
            {templateDrift ? (
              <p className="iwr-muted">Mẫu trên bản nháp khác chức vụ hiện tại. Giữ mẫu đã khóa.</p>
            ) : null}
            {!reportTemplate ? (
              <p className="iwr-muted">Admin chưa gán mẫu báo cáo. Không gửi được.</p>
            ) : null}
          </section>

          <section className="iwr-card iwr-blocker">
            <h2>
              <span className="iwr-summary__ico is-risk">▲</span> Blocker / Rủi ro
            </h2>
            {primaryBlocker && primaryMeta ? (
              <>
                <label className="iwr-field">
                  Mức độ
                  <select
                    disabled={readOnly}
                    value={primaryMeta.severity ?? 'high'}
                    onChange={(e) =>
                      updateMeta(primaryBlocker, { severity: e.target.value as IwrItemSeverity })
                    }
                  >
                    <option value="critical">Khẩn</option>
                    <option value="high">Cao</option>
                    <option value="medium">Trung bình</option>
                    <option value="low">Thấp</option>
                  </select>
                </label>
                <label className="iwr-field">
                  Nội dung
                  <textarea
                    disabled={readOnly}
                    value={primaryBlocker.title}
                    onChange={(e) => replaceItem({ ...primaryBlocker, title: e.target.value })}
                  />
                </label>
                <label className="iwr-field">
                  Cần hỗ trợ
                  <select
                    disabled={readOnly}
                    value={primaryMeta.support ?? 'Account Manager'}
                    onChange={(e) => updateMeta(primaryBlocker, { support: e.target.value })}
                  >
                    {SUPPORT_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="iwr-field">
                  Hạn xử lý
                  <input
                    type="date"
                    disabled={readOnly}
                    value={primaryMeta.due ?? ''}
                    onChange={(e) => updateMeta(primaryBlocker, { due: e.target.value })}
                  />
                </label>
                <p className="iwr-blocker__warn">
                  Vui lòng hỗ trợ để không ảnh hưởng tiến độ chiến dịch.
                </p>
                <button
                  type="button"
                  className="iwr-link"
                  data-testid="iwr-promote-risk"
                  onClick={() => void promoteIwrBlockerToRisk(token, report.id, primaryBlocker.id)}
                >
                  Nâng rủi ro: {primaryBlocker.title || primaryBlocker.id.slice(0, 8)}
                </button>
              </>
            ) : (
              <p className="iwr-empty">Không có blocker</p>
            )}
            {!readOnly && (
              <button type="button" className="iwr-add" disabled={busy} onClick={() => void createItem('blocked')}>
                + Thêm blocker
              </button>
            )}
            {blockedItems.slice(1).map((it) => (
              <p key={it.id} className="iwr-muted">
                {it.title}
              </p>
            ))}
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

function ProgressField({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <div className="iwr-progress">
      <div className="iwr-bar">
        <span style={{ width: `${value}%`, background: 'var(--iwr-blue)' }} />
      </div>
      <input
        type="number"
        min={0}
        max={100}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(clampProgress(e.target.value))}
      />
      <span>%</span>
    </div>
  );
}
