'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  IWR_STATUS_LABELS,
  ackIwrReport,
  fetchIwrDirectory,
  fetchIwrFiles,
  forwardIwrReport,
  promoteIwrBlockerToRisk,
  replyAllIwrReport,
  replyIwrReport,
  requestIwrChanges,
  uploadIwrFile,
  type IwrCommentRow,
  type IwrFileRow,
  type IwrItemRow,
  type IwrReportDetail,
  type IwrStaffNode,
} from '@/lib/crm/iwr-api';
import { iwrAvatarTone, iwrInitials, iwrRagClass, iwrRagLabel } from './iwr-format';
import { iwrInboxHasApprovals, iwrInboxProject, iwrInboxStatusBadge } from './iwr-inbox';
import { clampProgress, formatViTime, iwrItemText, parseIwrItemMeta } from './iwr-item-meta';

type IwrInboxDetailProps = {
  token: string;
  report: IwrReportDetail;
  canReview: boolean;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
};

type ReplyMode = 'reply' | 'reply_all';

const EMOJIS = ['👍', '✅', '⚠️', '🙏', '📌'];

function Icon({ d }: { d: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function itemsOf(report: IwrReportDetail, key: string): IwrItemRow[] {
  return (report.items ?? []).filter((it) => it.section_key === key);
}

function commentAuthor(comment: IwrCommentRow, report: IwrReportDetail): string {
  if (comment.created_by_staff_id === report.author_staff_id) return report.author_name ?? 'Người gửi';
  const rec = report.recipients.find((r) => r.staff_id === comment.created_by_staff_id);
  if (rec?.staff_name) return rec.staff_name;
  return `NV #${comment.created_by_staff_id}`;
}

export function IwrInboxDetail({ token, report, canReview, onReload, onError }: IwrInboxDetailProps) {
  const [files, setFiles] = useState<IwrFileRow[]>([]);
  const [mode, setMode] = useState<ReplyMode>('reply');
  const [draft, setDraft] = useState('');
  const [mentionQ, setMentionQ] = useState('');
  const [mentions, setMentions] = useState<IwrStaffNode[]>([]);
  const [mentionHits, setMentionHits] = useState<IwrStaffNode[]>([]);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardQ, setForwardQ] = useState('');
  const [forwardHits, setForwardHits] = useState<IwrStaffNode[]>([]);
  const [forwardTo, setForwardTo] = useState<IwrStaffNode[]>([]);
  const [forwardNote, setForwardNote] = useState('');
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeBody, setChangeBody] = useState('');
  const [taskOpen, setTaskOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const toRecipients = report.recipients.filter((r) => r.kind === 'to');
  const ccRecipients = report.recipients.filter((r) => r.kind === 'cc');
  const done = itemsOf(report, 'done');
  const wip = itemsOf(report, 'wip').concat(itemsOf(report, 'deliverables'));
  const blocked = itemsOf(report, 'blocked');
  const highlights = itemsOf(report, 'highlights');
  const kpi = itemsOf(report, 'kpi');
  const next = itemsOf(report, 'next').concat(itemsOf(report, 'next_week'));
  const support = [...wip, ...blocked].filter((it) => parseIwrItemMeta(it.body).support);
  const project = iwrInboxProject(report);
  const statusBadge = iwrInboxStatusBadge(report.status, report.rag);
  const isAuthor = report.viewer_is_author !== false;
  const isReviewer = Boolean(report.viewer_is_reviewer) || canReview;

  useEffect(() => {
    void fetchIwrFiles(token, report.id)
      .then((out) => setFiles(out.items ?? []))
      .catch(() => setFiles([]));
  }, [token, report.id]);

  useEffect(() => {
    const q = mentionQ.trim();
    if (q.length < 1) {
      setMentionHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchIwrDirectory(token, q, 'mention')
        .then((out) => setMentionHits(out.items ?? []))
        .catch(() => setMentionHits([]));
    }, 180);
    return () => window.clearTimeout(t);
  }, [token, mentionQ]);

  useEffect(() => {
    if (!forwardOpen || forwardQ.trim().length < 1) {
      setForwardHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchIwrDirectory(token, forwardQ.trim(), 'cc')
        .then((out) => setForwardHits(out.items ?? []))
        .catch(() => setForwardHits([]));
    }, 180);
    return () => window.clearTimeout(t);
  }, [token, forwardOpen, forwardQ]);

  const timeline = useMemo(() => {
    const events: { key: string; label: string; who: string; at: string }[] = [];
    if (report.submitted_at) {
      events.push({
        key: 'sent',
        label: 'Đã gửi',
        who: report.author_name ?? 'Người gửi',
        at: report.submitted_at,
      });
    }
    if (report.first_viewed_at) {
      events.push({
        key: 'seen',
        label: 'Đã xem',
        who: toRecipients[0]?.staff_name ?? 'Người nhận',
        at: report.first_viewed_at,
      });
    }
    for (const c of report.comments) {
      events.push({
        key: `c-${c.id}`,
        label: 'Phản hồi',
        who: commentAuthor(c, report),
        at: c.created_at,
      });
    }
    if (report.acknowledged_at) {
      events.push({
        key: 'ack',
        label: 'Đã xác nhận',
        who: toRecipients[0]?.staff_name ?? 'QLTT',
        at: report.acknowledged_at,
      });
    }
    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return events;
  }, [report, toRecipients]);

  function fail(err: unknown, fallback: string) {
    onError(err instanceof Error ? err.message : fallback);
  }

  async function sendReply() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const mentionIds = mentions.map((m) => m.id);
      if (mode === 'reply_all') {
        await replyAllIwrReport(token, report.id, { body_text: body });
      } else {
        await replyIwrReport(token, report.id, { body_text: body, mention_staff_ids: mentionIds });
      }
      setDraft('');
      setMentions([]);
      await onReload();
    } catch (err) {
      fail(err, 'Gửi phản hồi thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function sendChanges() {
    if (changeBody.trim().length < 3 || busy) return;
    setBusy(true);
    try {
      await requestIwrChanges(token, report.id, { body_text: changeBody.trim() });
      setChangeOpen(false);
      setChangeBody('');
      await onReload();
    } catch (err) {
      fail(err, 'Yêu cầu bổ sung thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function sendForward() {
    if (!forwardTo.length || forwardNote.trim().length < 1 || busy) return;
    setBusy(true);
    try {
      await forwardIwrReport(token, report.id, {
        to_staff_ids: forwardTo.map((s) => s.id),
        note: forwardNote.trim(),
      });
      setForwardOpen(false);
      setForwardTo([]);
      setForwardNote('');
      await onReload();
    } catch (err) {
      fail(err, 'Chuyển tiếp thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function createTask(itemId: string) {
    setBusy(true);
    try {
      await promoteIwrBlockerToRisk(token, report.id, itemId);
      setTaskOpen(false);
      await onReload();
    } catch (err) {
      fail(err, 'Tạo task / rủi ro thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onAck() {
    setBusy(true);
    try {
      await ackIwrReport(token, report.id);
      await onReload();
    } catch (err) {
      fail(err, 'Xác nhận thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onAttach(file: File) {
    setBusy(true);
    try {
      const uploaded = await uploadIwrFile(token, report.id, file);
      setFiles((prev) => [uploaded, ...prev]);
      setDraft((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}[Tệp: ${uploaded.file_name}]`);
    } catch (err) {
      fail(err, 'Tải tệp thất bại');
    } finally {
      setBusy(false);
    }
  }

  const seenAt = report.first_viewed_at ? formatViTime(report.first_viewed_at) : '';

  return (
    <article className="iwr-read">
      <header className="iwr-read__head">
        <div className="iwr-person">
          <span className={iwrAvatarTone(report.author_staff_id)}>{iwrInitials(report.author_name)}</span>
          <div>
            <strong>{report.author_name ?? `NV #${report.author_staff_id}`}</strong>
            <div className="iwr-muted">{report.template_name_vi}</div>
          </div>
        </div>
        <div className="iwr-read__acts">
          <button type="button" className="iwr-btn" onClick={() => setMode('reply')}>
            Trả lời
          </button>
          <button type="button" className="iwr-btn" onClick={() => setMode('reply_all')}>
            Trả lời tất cả
          </button>
          <button type="button" className="iwr-btn" onClick={() => setForwardOpen(true)}>
            Chuyển tiếp
          </button>
          <div className="iwr-more">
            <button type="button" className="iwr-btn" aria-label="Thêm" onClick={() => setMoreOpen((v) => !v)}>
              ⋯
            </button>
            {moreOpen && (
              <ul className="iwr-more__menu">
                <li>
                  <Link href={`/crm/internal-reports/${report.id}`} onClick={() => setMoreOpen(false)}>
                    Mở trang đầy đủ
                  </Link>
                </li>
                {isReviewer && report.status !== 'acknowledged' && report.status !== 'draft' && (
                  <li>
                    <button type="button" disabled={busy} onClick={() => void onAck()}>
                      Xác nhận đã xem
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </header>

      <h2 className="iwr-read__title">{report.title}</h2>
      <div className="iwr-read__meta">
        <div>
          <span className="iwr-mail__k">Đến</span>{' '}
          {toRecipients.length
            ? toRecipients.map((r) => r.staff_name ?? `#${r.staff_id}`).join(', ')
            : 'QLTT'}
        </div>
        {ccRecipients.length > 0 && (
          <div>
            <span className="iwr-mail__k">Cc</span>{' '}
            {ccRecipients.map((r) => r.staff_name ?? `#${r.staff_id}`).join(', ')}
          </div>
        )}
        {seenAt && (
          <div className="iwr-read__seen">
            <Icon d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            Đã xem lúc {seenAt}
          </div>
        )}
      </div>

      <div className="iwr-read__tags">
        {project && <span className="iwr-chip">{project}</span>}
        <span className="iwr-chip">{report.template_name_vi}</span>
        <span className={iwrRagClass(report.rag)}>{iwrRagLabel(report.rag)}</span>
        {statusBadge && <span className={`iwr-pill iwr-pill--${statusBadge.tone}`}>{statusBadge.text}</span>}
        {iwrInboxHasApprovals(report) && <span className="iwr-pill iwr-pill--blue">Cần BOD duyệt</span>}
        <span className="iwr-chip">{IWR_STATUS_LABELS[report.status]}</span>
      </div>

      <div className="iwr-read__grid">
        <div className="iwr-read__body">
          {highlights.length > 0 && (
            <section className="iwr-read__sec">
              <h3>Điểm nhấn</h3>
              <ul>
                {highlights.map((it) => (
                  <li key={it.id}>{it.title || iwrItemText(parseIwrItemMeta(it.body))}</li>
                ))}
              </ul>
            </section>
          )}

          {(done.length > 0 || report.sections_json?.done?.body) && (
            <section className="iwr-read__sec">
              <h3>Kết quả đã hoàn thành</h3>
              <ul className="iwr-read__checks">
                {done.map((it) => {
                  const meta = parseIwrItemMeta(it.body);
                  const href = it.evidence_url && /^https?:\/\//i.test(it.evidence_url) ? it.evidence_url : null;
                  return (
                    <li key={it.id}>
                      <span>{it.title || iwrItemText(meta)}</span>
                      {(href || it.evidence_url) &&
                        (href ? (
                          <a className="iwr-link" href={href} target="_blank" rel="noreferrer">
                            Bằng chứng
                          </a>
                        ) : (
                          <span className="iwr-muted">Bằng chứng</span>
                        ))}
                    </li>
                  );
                })}
                {!done.length &&
                  String(report.sections_json?.done?.body ?? '')
                    .split('\n')
                    .filter((l) => l.trim())
                    .map((line) => <li key={line}>{line.replace(/^[-*•]\s*/, '')}</li>)}
              </ul>
            </section>
          )}

          {wip.length > 0 && (
            <section className="iwr-read__sec">
              <h3>Đang thực hiện</h3>
              {wip.map((it) => {
                const meta = parseIwrItemMeta(it.body);
                const progress = clampProgress(meta.progress);
                return (
                  <div key={it.id} className="iwr-read__wip">
                    <div>{it.title || iwrItemText(meta)}</div>
                    <div className="iwr-progress">
                      <div className="iwr-bar">
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <span>{progress}%</span>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {kpi.length > 0 && (
            <section className="iwr-read__sec">
              <h3>KPI</h3>
              <ul>
                {kpi.map((it) => (
                  <li key={it.id}>{it.title}</li>
                ))}
              </ul>
            </section>
          )}

          {(blocked.length > 0 || report.sections_json?.blocked?.body) && (
            <section className="iwr-read__callout iwr-read__callout--danger">
              <h3>Blocker / Rủi ro</h3>
              {blocked.map((it) => (
                <p key={it.id}>{it.title || iwrItemText(parseIwrItemMeta(it.body))}</p>
              ))}
              {!blocked.length && <p>{String(report.sections_json?.blocked?.body ?? '')}</p>}
            </section>
          )}

          {(support.length > 0 || next.length > 0) && (
            <section className="iwr-read__callout iwr-read__callout--warn">
              <h3>Cần hỗ trợ</h3>
              {support.map((it) => {
                const meta = parseIwrItemMeta(it.body);
                return (
                  <p key={it.id}>
                    {it.title || iwrItemText(meta)}
                    {meta.support ? ` — ${meta.support}` : ''}
                  </p>
                );
              })}
              {!support.length &&
                next.map((it) => <p key={it.id}>{it.title || iwrItemText(parseIwrItemMeta(it.body))}</p>)}
            </section>
          )}

          {files.length > 0 && (
            <section className="iwr-read__sec">
              <h3>Tệp đính kèm</h3>
              <ul>
                {files.map((f) => (
                  <li key={f.id}>{f.file_name}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="iwr-read__thread">
            <h3>Phản hồi</h3>
            <ul className="iwr-comments">
              {report.comments.map((c) => (
                <li key={c.id} className="iwr-read__bubble">
                  <div className="iwr-person">
                    <span className={iwrAvatarTone(c.created_by_staff_id)}>
                      {iwrInitials(commentAuthor(c, report))}
                    </span>
                    <div>
                      <strong>{commentAuthor(c, report)}</strong>
                      <div className="iwr-muted">{formatViTime(c.created_at)}</div>
                    </div>
                  </div>
                  <p>{c.body_text}</p>
                </li>
              ))}
              {!report.comments.length && <li className="iwr-empty">Chưa có phản hồi</li>}
            </ul>

            <div className="iwr-composer">
              <div className="iwr-muted">
                {mode === 'reply_all' ? 'Trả lời tất cả' : 'Trả lời'}
                {mentions.length > 0 && ` · @${mentions.map((m) => m.name).join(', @')}`}
              </div>
              <textarea
                className="iwr-input"
                rows={3}
                placeholder="Viết phản hồi hoặc @mention..."
                value={draft}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  setDraft(nextVal);
                  const at = nextVal.match(/@([^\s@]*)$/);
                  setMentionQ(at ? at[1] : '');
                }}
              />
              {mentionHits.length > 0 && (
                <ul className="iwr-mail__hits">
                  {mentionHits.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setMentions((prev) => (prev.some((m) => m.id === hit.id) ? prev : [...prev, hit]));
                          setDraft((prev) => prev.replace(/@([^\s@]*)$/, `@${hit.name} `));
                          setMentionQ('');
                        }}
                      >
                        {hit.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="iwr-composer__tools">
                <label className="iwr-btn">
                  Đính kèm
                  <input
                    type="file"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void onAttach(file);
                    }}
                  />
                </label>
                {EMOJIS.map((emo) => (
                  <button key={emo} type="button" className="iwr-emoji" onClick={() => setDraft((p) => `${p}${emo}`)}>
                    {emo}
                  </button>
                ))}
              </div>
              <div className="iwr-composer__acts">
                <button type="button" className="iwr-btn iwr-btn--primary" disabled={!draft.trim() || busy} onClick={() => void sendReply()}>
                  Gửi phản hồi
                </button>
                <button
                  type="button"
                  className="iwr-btn"
                  disabled={busy}
                  onClick={() => (blocked.length ? setTaskOpen(true) : onError('Không có blocker để tạo task'))}
                >
                  Tạo task
                </button>
                {(isReviewer || !isAuthor) && (
                  <button type="button" className="iwr-btn" disabled={busy} onClick={() => setChangeOpen(true)}>
                    Yêu cầu bổ sung
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="iwr-read__time" aria-label="Lịch sử">
          {timeline.map((ev) => (
            <div key={ev.key} className="iwr-read__event">
              <strong>{ev.label}</strong>
              <div>{ev.who}</div>
              <div className="iwr-muted">{formatViTime(ev.at)}</div>
            </div>
          ))}
          {!timeline.length && <div className="iwr-empty">Chưa có hoạt động</div>}
        </aside>
      </div>

      {forwardOpen && (
        <div className="iwr-modal">
          <div className="iwr-modal__box">
            <div className="iwr-mail__k">Chuyển tiếp</div>
            <input
              className="iwr-input"
              placeholder="Tìm người nhận..."
              value={forwardQ}
              onChange={(e) => setForwardQ(e.target.value)}
            />
            <div className="iwr-mail__people">
              {forwardTo.map((s) => (
                <span key={s.id} className="iwr-mail__chip">
                  {s.name}
                </span>
              ))}
            </div>
            {forwardHits.length > 0 && (
              <ul className="iwr-mail__hits">
                {forwardHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setForwardTo((prev) => (prev.some((s) => s.id === hit.id) ? prev : [...prev, hit]));
                        setForwardQ('');
                      }}
                    >
                      {hit.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <textarea
              className="iwr-input"
              placeholder="Ghi chú kèm theo"
              value={forwardNote}
              onChange={(e) => setForwardNote(e.target.value)}
            />
            <div className="iwr-pagehead__actions">
              <button type="button" className="iwr-btn" onClick={() => setForwardOpen(false)}>
                Huỷ
              </button>
              <button
                type="button"
                className="iwr-btn iwr-btn--primary"
                disabled={!forwardTo.length || forwardNote.trim().length < 1 || busy}
                onClick={() => void sendForward()}
              >
                Gửi
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
                onClick={() => void sendChanges()}
              >
                Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}

      {taskOpen && (
        <div className="iwr-modal">
          <div className="iwr-modal__box">
            <div className="iwr-mail__k">Tạo task từ blocker</div>
            {blocked.map((it) => (
              <button key={it.id} type="button" className="iwr-btn" disabled={busy} onClick={() => void createTask(it.id)}>
                {it.title || it.id.slice(0, 8)}
              </button>
            ))}
            <button type="button" className="iwr-btn" onClick={() => setTaskOpen(false)}>
              Huỷ
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
