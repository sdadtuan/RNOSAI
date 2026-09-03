'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IWR_RAG_LABELS,
  IWR_STATUS_LABELS,
  addIwrItem,
  applyIwrSources,
  fetchIwrItems,
  fetchIwrSources,
  fetchIwrSuggest,
  promoteIwrBlockerToRisk,
  replyAllIwrReport,
  iwrCsvUrl,
  iwrPdfUrl,
  iwrSectionLabel,
  iwrXlsxUrl,
  type IwrCommentRow,
  type IwrItemRow,
  type IwrRag,
  type IwrReportDetail,
  type IwrReportRow,
  type IwrReportStatus,
  type IwrSuggestHit,
} from '@/lib/crm/iwr-api';
import { IwrPeoplePicker, iwrInitialToChip, type IwrPersonChip } from './IwrPeoplePicker';

type BlockerItem = { title: string; description: string; severity: string };

type IwrReportEditorProps = {
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

function sectionKeys(report: IwrReportDetail): string[] {
  return Object.keys(report.sections_json ?? {});
}

function readBody(report: IwrReportDetail, key: string): string {
  const sec = report.sections_json?.[key];
  if (!sec || typeof sec !== 'object') return '';
  return String((sec as { body?: string }).body ?? '');
}

function readItems(report: IwrReportDetail, key: string): BlockerItem[] {
  const sec = report.sections_json?.[key];
  if (!sec || typeof sec !== 'object') return [];
  const items = (sec as { items?: unknown[] }).items;
  if (!Array.isArray(items)) return [];
  return items.map((it) => {
    const row = it as BlockerItem;
    return {
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      severity: String(row.severity ?? 'medium'),
    };
  });
}

export function IwrReportEditor({
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
}: IwrReportEditorProps) {
  const isAuthor = Boolean(report.viewer_is_author);
  const isReviewer = Boolean(report.viewer_is_reviewer);
  const readOnly = IMMUTABLE.has(report.status) || !isAuthor || !EDITABLE.has(report.status);
  const toRecipient = report.recipients.find((r) => r.kind === 'to');
  const [sections, setSections] = useState(report.sections_json);
  const [rag, setRag] = useState<IwrRag>(report.rag);
  const [toPerson, setToPerson] = useState<IwrPersonChip | null>(() =>
    iwrInitialToChip(report.id, toRecipient, readOnly),
  );
  const [ccIds, setCcIds] = useState<number[]>(
    report.recipients.filter((r) => r.kind === 'cc').map((r) => r.staff_id),
  );
  const [bccIds, setBccIds] = useState<number[]>(
    report.recipients.filter((r) => r.kind === 'bcc').map((r) => r.staff_id),
  );
  const [lateOpen, setLateOpen] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeBody, setChangeBody] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<IwrItemRow[]>(report.items ?? []);
  const [suggestHits, setSuggestHits] = useState<IwrSuggestHit[]>([]);
  const [sourceRows, setSourceRows] = useState<IwrReportRow[]>([]);
  const [pickedSources, setPickedSources] = useState<string[]>(report.source_report_ids ?? []);
  const [ragReason, setRagReason] = useState(report.rag_override_reason ?? '');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void fetchIwrItems(token, report.id).then((out) => setItems(out.items ?? [])).catch(() => undefined);
    void fetchIwrSuggest(token, report.id).then((out) => setSuggestHits(out.items ?? [])).catch(() => undefined);
    if (report.template_code === 'weekly_work' || report.template_code === 'monthly_work') {
      void fetchIwrSources(token, report.id).then((out) => setSourceRows(out.items ?? [])).catch(() => undefined);
    }
  }, [token, report.id, report.template_code]);

  const keys = useMemo(() => sectionKeys(report), [report]);
  const isWeekly = report.template_code === 'weekly_work' || report.template_code === 'monthly_work';

  const clearedDefaultTo = useRef(false);
  useEffect(() => {
    if (readOnly || clearedDefaultTo.current || toPerson || !toRecipient) return;
    clearedDefaultTo.current = true;
    void onPatch({ to_staff_id: null });
  }, [readOnly, toPerson, toRecipient, onPatch]);

  useEffect(() => {
    setSections(report.sections_json);
    setRag(report.rag);
    setCcIds(report.recipients.filter((r) => r.kind === 'cc').map((r) => r.staff_id));
    setBccIds(report.recipients.filter((r) => r.kind === 'bcc').map((r) => r.staff_id));
  }, [report]);

  const scheduleSave = useCallback(
    (next: Record<string, unknown>, nextRag?: IwrRag) => {
      if (readOnly) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void onPatch({
          sections_json: next,
          rag: nextRag ?? rag ?? undefined,
          cc_staff_ids: ccIds,
        });
      }, 800);
    },
    [readOnly, onPatch, rag, ccIds],
  );

  function setBody(key: string, body: string) {
    const next = {
      ...sections,
      [key]: { ...(sections[key] as object), body, items: readItems({ ...report, sections_json: sections }, key) },
    };
    setSections(next);
    scheduleSave(next);
  }

  function setBlockers(items: BlockerItem[]) {
    const next = {
      ...sections,
      blocked: { body: readBody({ ...report, sections_json: sections }, 'blocked'), items },
    };
    setSections(next);
    scheduleSave(next);
  }

  async function handleSubmit() {
    const due = new Date(report.due_at).getTime();
    if (Date.now() > due && !lateReason.trim()) {
      setLateOpen(true);
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        late_reason: lateReason.trim() || undefined,
        to_staff_id: toRecipient?.staff_id,
        cc_staff_ids: ccIds,
        bcc_staff_ids: canBcc ? bccIds : undefined,
      });
      setLateOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Nội bộ — không gửi khách trừ khi đã duyệt ngoại
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span>
          Trạng thái: <strong>{IWR_STATUS_LABELS[report.status]}</strong>
        </span>
        <span>Kỳ: {report.period_start} — {report.period_end}</span>
        <span>Hạn: {new Date(report.due_at).toLocaleString('vi-VN')}</span>
        {report.is_late && <span className="text-red-600">Nộp muộn</span>}
        <a
          className="text-blue-600 underline"
          href={iwrPdfUrl(report.id)}
          target="_blank"
          rel="noreferrer"
        >
          Tải PDF
        </a>
        <a className="text-blue-600 underline" href={iwrXlsxUrl(report.id)} target="_blank" rel="noreferrer">
          XLSX
        </a>
        <a className="text-blue-600 underline" href={iwrCsvUrl(report.id)} target="_blank" rel="noreferrer">
          CSV
        </a>
        {report.first_viewed_at && (
          <span data-testid="iwr-viewed" className="text-emerald-700">
            Đã xem
          </span>
        )}
      </div>

      {isWeekly && report.rag_hint && (
        <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          RAG gợi ý:{' '}
          <strong>{IWR_RAG_LABELS[report.rag_hint.rag]}</strong>
          {report.rag_hint.reasons.length ? ` (${report.rag_hint.reasons.join(', ')})` : ''}
          {' — '}không ghi đè lựa chọn của bạn.
          {!readOnly && report.rag && report.rag !== report.rag_hint.rag && (
            <div className="mt-2">
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="Lý do giữ RAG khác gợi ý"
                value={ragReason}
                onChange={(e) => {
                  setRagReason(e.target.value);
                  void onPatch({ rag_override_reason: e.target.value, rag: rag ?? undefined });
                }}
              />
            </div>
          )}
        </div>
      )}

      {suggestHits.length > 0 && !readOnly && (
        <div className="rounded border p-4 space-y-2" data-testid="iwr-suggest">
          <div className="text-sm font-medium">Gợi ý hôm nay</div>
          <div className="flex flex-wrap gap-2">
            {suggestHits.map((hit) => (
              <button
                key={`${hit.kind}-${hit.id}`}
                type="button"
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-blue-50"
                onClick={() => {
                  void addIwrItem(token, report.id, {
                    section_key: 'done',
                    title: hit.label,
                    body: '',
                    ref_kind: hit.kind,
                    ref_id: hit.id,
                    evidence_url: null,
                    sort_order: items.length,
                  }).then((row) => setItems((prev) => [...prev, row]));
                }}
              >
                + {hit.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isWeekly && sourceRows.length > 0 && !readOnly && (
        <div className="rounded border p-4 space-y-2">
          <div className="text-sm font-medium">Gộp ngày → tuần</div>
          {sourceRows.map((src) => (
            <label key={src.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pickedSources.includes(src.id)}
                onChange={() =>
                  setPickedSources((prev) =>
                    prev.includes(src.id) ? prev.filter((x) => x !== src.id) : [...prev, src.id],
                  )
                }
              />
              {src.title} ({src.period_start})
            </label>
          ))}
          <button
            type="button"
            className="text-sm text-blue-600"
            onClick={() => {
              void applyIwrSources(token, report.id, pickedSources).then(() => undefined);
            }}
          >
            Gộp các ngày đã chọn
          </button>
        </div>
      )}

      {items.some((it) => it.section_key === 'done' && it.ref_kind === 'none' && !it.evidence_url) && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Dòng việc xong chưa gắn ticket/lead — nộp vẫn được, nên bổ sung bằng chứng.
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded border p-4 space-y-2">
          <div className="text-sm font-medium">Dòng bằng chứng</div>
          <ul className="text-sm space-y-1">
            {items.map((it) => (
              <li key={it.id}>
                {it.title || '(không tiêu đề)'} · {it.ref_kind}
                {it.ref_id ? ` #${it.ref_id}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded border p-4 space-y-2 iwr-mail">
        <div className="text-sm font-medium">Người nhận</div>
        <IwrPeoplePicker
          token={token}
          purpose="to"
          label="Đến"
          placeholder="Tìm người nhận..."
          selected={toPerson ? [toPerson] : []}
          onChange={(next) => {
            const person = next[0] ?? null;
            setToPerson(person);
            void onPatch({ to_staff_id: person?.id ?? null });
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
          selected={ccIds.map((id) => ({ id, name: `#${id}` }))}
          onChange={(next) => {
            const ids = next.map((p) => p.id);
            setCcIds(ids);
            void onPatch({ cc_staff_ids: ids });
          }}
          disabled={readOnly}
        />
        {canBcc && !readOnly && isAuthor && (
          <IwrPeoplePicker
            token={token}
            purpose="bcc"
            label="Bcc"
            placeholder="Tìm Bcc..."
            selected={bccIds.map((id) => ({ id, name: `#${id}` }))}
            onChange={(next) => setBccIds(next.map((p) => p.id))}
            testId="iwr-bcc"
          />
        )}
        {report.recipients.some((r) => r.kind === 'bcc') && (
          <div className="text-xs text-slate-500">
            Bcc hiển thị:{' '}
            {report.recipients
              .filter((r) => r.kind === 'bcc')
              .map((r) => r.staff_name ?? r.staff_id)
              .join(', ') || '—'}
          </div>
        )}
      </div>

      {isWeekly && (
        <div className="rounded border p-4 space-y-2">
          <div className="text-sm font-medium">RAG (bắt buộc trước khi nộp)</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(IWR_RAG_LABELS) as Exclude<IwrRag, null>[]).map((v) => (
              <label key={v} className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="rag"
                  disabled={readOnly}
                  checked={(rag ?? readBody({ ...report, sections_json: sections }, 'rag')) === v}
                  onChange={() => {
                    setRag(v);
                    setBody('rag', v);
                    scheduleSave({ ...sections, rag: { body: v, items: [] } }, v);
                  }}
                />
                {IWR_RAG_LABELS[v]}
              </label>
            ))}
          </div>
        </div>
      )}

      {keys.filter((k) => k !== 'rag').map((key) => (
        <div key={key} className="rounded border p-4 space-y-2">
          <div className="text-sm font-medium">{iwrSectionLabel(key)}</div>
          {key === 'blocked' ? (
            <div className="space-y-3">
              {readItems({ ...report, sections_json: sections }, 'blocked').map((item, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-3">
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    disabled={readOnly}
                    value={item.title}
                    placeholder="Tiêu đề"
                    onChange={(e) => {
                      const items = readItems({ ...report, sections_json: sections }, 'blocked');
                      items[idx] = { ...items[idx], title: e.target.value };
                      setBlockers(items);
                    }}
                  />
                  <input
                    className="border rounded px-2 py-1 text-sm md:col-span-2"
                    disabled={readOnly}
                    value={item.description}
                    placeholder="Mô tả"
                    onChange={(e) => {
                      const items = readItems({ ...report, sections_json: sections }, 'blocked');
                      items[idx] = { ...items[idx], description: e.target.value };
                      setBlockers(items);
                    }}
                  />
                </div>
              ))}
              {!readOnly && (
                <button
                  type="button"
                  className="text-sm text-blue-600"
                  onClick={() =>
                    setBlockers([
                      ...readItems({ ...report, sections_json: sections }, 'blocked'),
                      { title: '', description: '', severity: 'medium' },
                    ])
                  }
                >
                  + Thêm blocker
                </button>
              )}
              {items
                .filter((it) => it.section_key === 'blocked')
                .map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="text-xs text-amber-700 underline"
                    data-testid="iwr-promote-risk"
                    onClick={() => void promoteIwrBlockerToRisk(token, report.id, it.id)}
                  >
                    Nâng rủi ro: {it.title || it.id.slice(0, 8)}
                  </button>
                ))}
            </div>
          ) : (
            <textarea
              className="w-full min-h-[96px] border rounded px-3 py-2 text-sm"
              disabled={readOnly}
              value={readBody({ ...report, sections_json: sections }, key)}
              onChange={(e) => setBody(key, e.target.value)}
            />
          )}
        </div>
      ))}

      <div className="rounded border p-4 space-y-3">
        <div className="text-sm font-medium">Phản hồi</div>
        <ul className="space-y-2 text-sm">
          {comments.map((c) => (
            <li key={c.id} className="border-l-2 border-slate-200 pl-3">
              <div className="text-xs text-slate-500">
                {c.section_key ? iwrSectionLabel(c.section_key) : 'Chung'} · {new Date(c.created_at).toLocaleString('vi-VN')}
              </div>
              <div>{c.body_text}</div>
            </li>
          ))}
          {!comments.length && <li className="text-slate-500">Chưa có phản hồi</li>}
        </ul>
        {!IMMUTABLE.has(report.status) && (
          <div className="flex gap-2 flex-wrap">
            <input
              className="flex-1 min-w-[200px] border rounded px-2 py-1 text-sm"
              placeholder="Viết phản hồi..."
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
            <button
              type="button"
              className="px-3 py-1 text-sm rounded bg-slate-800 text-white"
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
                className="px-3 py-1 text-sm rounded border"
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
      </div>

      <div className="flex flex-wrap gap-2">
        {isAuthor && canWrite && EDITABLE.has(report.status) && (
          <>
            <button
              type="button"
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() => void handleSubmit()}
            >
              Nộp
            </button>
            {(report.status === 'submitted' || report.status === 'supplemented') && (
              <button
                type="button"
                className="px-4 py-2 rounded border text-sm"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void onWithdraw().finally(() => setBusy(false));
                }}
              >
                Rút
              </button>
            )}
          </>
        )}
        {canReview && isReviewer && (report.status === 'submitted' || report.status === 'supplemented') && (
          <>
            <button
              type="button"
              className="px-4 py-2 rounded bg-green-600 text-white text-sm"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void onAck().finally(() => setBusy(false));
              }}
            >
              Xác nhận
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded border text-sm"
              onClick={() => setChangeOpen(true)}
            >
              Yêu cầu bổ sung
            </button>
          </>
        )}
      </div>

      {lateOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-4 max-w-md w-full space-y-3">
            <div className="font-medium">Nộp muộn — nhập lý do</div>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-1 border rounded text-sm" onClick={() => setLateOpen(false)}>
                Huỷ
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-4 max-w-md w-full space-y-3">
            <div className="font-medium">Yêu cầu bổ sung</div>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
              value={changeBody}
              onChange={(e) => setChangeBody(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-1 border rounded text-sm" onClick={() => setChangeOpen(false)}>
                Huỷ
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded bg-amber-600 text-white text-sm"
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
