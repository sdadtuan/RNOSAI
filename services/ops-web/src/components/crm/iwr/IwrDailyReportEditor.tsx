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
  parseIwrItemMeta,
  serializeIwrItemMeta,
  type IwrItemMeta,
  type IwrItemPriority,
  type IwrItemSeverity,
} from './iwr-item-meta';

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
};

const IMMUTABLE = new Set<IwrReportStatus>(['acknowledged', 'waived', 'archived']);
const EDITABLE = new Set<IwrReportStatus>(['draft', 'changes_requested']);
const SUPPORT_ROLES = ['Account Manager', 'Team Lead', 'PM', 'Khác'];

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
  const url = item.evidence_url ?? '';
  if (/^https?:\/\//i.test(url)) return url;
  return null;
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
  const itemTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void fetchIwrItems(token, report.id)
      .then((out) => setItems(out.items ?? []))
      .catch(() => undefined);
    void fetchIwrSuggest(token, report.id)
      .then((out) => setSuggestHits(out.items ?? []))
      .catch(() => undefined);
  }, [token, report.id]);

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
      return {
        ...(report.sections_json ?? {}),
        done: { body: of('done').map(line).join('\n'), items: [] },
        wip: { body: of('wip').map(line).join('\n'), items: [] },
        next: { body: of('next').map(line).join('\n'), items: [] },
        blocked: { body: blocked.map((b) => b.title).join('\n'), items: blocked },
      };
    },
    [report.sections_json],
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
            <h2>Kết quả đã hoàn thành</h2>
            {doneItems.map((it, idx) => {
              const meta = parseIwrItemMeta(it.body);
              const file = evidenceLabel(it, meta);
              const href = evidenceHref(it);
              return (
                <article key={it.id} className="iwr-task">
                  <label className="iwr-check">
                    <input
                      type="checkbox"
                      checked
                      disabled={readOnly}
                      onChange={() => void moveSection(it, 'wip')}
                    />
                    <span>
                      {idx + 1}.{' '}
                      <input
                        className="iwr-ghost"
                        disabled={readOnly}
                        value={it.title}
                        onChange={(e) => replaceItem({ ...it, title: e.target.value })}
                      />
                    </span>
                  </label>
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
                    <div className="iwr-evidence">
                      {file ? (
                        href ? (
                          <a href={href} target="_blank" rel="noreferrer" className="iwr-link">
                            {file}
                          </a>
                        ) : (
                          <span>{file}</span>
                        )
                      ) : (
                        <span className="iwr-muted">Chưa có bằng chứng</span>
                      )}
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
                      {!readOnly && (
                        <input
                          className="iwr-ghost iwr-ghost--url"
                          placeholder="Hoặc dán URL"
                          value={/^https?:\/\//i.test(it.evidence_url ?? '') ? it.evidence_url ?? '' : ''}
                          onChange={(e) =>
                            updateMeta(it, { evidence_name: evidenceLabel({ ...it, evidence_url: e.target.value }, meta) }, {
                              evidence_url: e.target.value || null,
                            })
                          }
                        />
                      )}
                    </div>
                    {it.ref_kind !== 'none' && <span className="iwr-muted">{it.ref_kind}</span>}
                    {!readOnly && (
                      <button type="button" className="iwr-iconbtn" onClick={() => void removeItem(it.id)}>
                        Xoá
                      </button>
                    )}
                  </div>
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
                    <td colSpan={5} className="iwr-empty">
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
            </ul>
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
