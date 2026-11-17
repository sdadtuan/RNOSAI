'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PortalCareCase, PortalDeskPage } from '@/lib/api';
import { fetchPortalCase, type PortalCaseDetail } from '@/lib/api';
import { posGet, vnd, POS_STATUS_LABEL, type PosOrder } from '@/lib/portal-pos-api';
import { PortalPosOrderForm } from '@/components/portal-pos/PortalPosOrderForm';
import {
  findLinkedCommentHint,
  findLinkedConversation,
  formatLeadPhoneDisplay,
  humanizeLeadFieldLabel,
  humanizeLeadFieldValue,
  leadEmail,
  leadFormLabel,
  leadInteractedAt,
  leadPhone,
  leadPhoneHref,
  leadSource,
  leadTagColor,
} from '@/lib/portal/portal-leads-table.util';
import { leadAgeLabel, leadSla, staffLabel, toneFor } from '@/lib/portal/portal-leads-pro.util';
import { canActOnCase, canManagePortal, isPortalReadOnly, VIEWER_READ_ONLY_HINT } from '@/lib/portal-role';
import { LEAD_STATUS_LABEL, PlAvatar, PlIcon, PlStatus } from '@/components/portal-crm/PortalLeadBits';

export { LEAD_STATUS_LABEL };

const STAGES = ['waiting_receive', 'received', 'caring', 'purchased'] as const;

export function leadStatusChipClass(status: string): string {
  if (status === 'waiting_receive') return 'portal-chip portal-chip--waiting';
  if (status === 'received') return 'portal-chip portal-chip--received';
  if (status === 'caring') return 'portal-chip portal-chip--caring';
  if (status === 'purchased') return 'portal-chip portal-chip--purchased';
  return 'portal-chip';
}

export function formatSaigonDateTime(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Kept for compatibility; the redesigned page opens the drawer only on demand. */
export function PortalLeadEmptyPanel({ loading = false, hasLeads = false }: { loading?: boolean; hasLeads?: boolean }) {
  const title = loading ? 'Đang tải…' : hasLeads ? 'Chọn một lead để xem chi tiết' : 'Chưa có lead';
  return (
    <aside className="pld pld--empty" aria-label="Chi tiết lead">
      <div className="pld__body">
        <p className="pld__muted">{title}</p>
      </div>
    </aside>
  );
}

export type LeadLabelCatalog = Array<{ id: string; name: string; color: string }>;

function Section({ icon, title, extra, children }: { icon: string; title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="pld__sec">
      <header>
        <h4>
          <PlIcon name={icon} size={14} />
          {title}
        </h4>
        {extra}
      </header>
      {children}
    </section>
  );
}

export function PortalLeadPanel({
  row,
  pages,
  staff,
  staffNames = {},
  role,
  userId,
  busy,
  onAct,
  token,
  labels = [],
  messages = [],
  onNotes,
  onClose,
}: {
  row: PortalCareCase;
  pages: PortalDeskPage[];
  staff: Array<{ id: string; email: string }>;
  staffNames?: Record<string, string>;
  role: string;
  userId: string;
  busy: boolean;
  onAct: (id: string, action: string, body?: Record<string, string>) => void;
  token?: string;
  labels?: LeadLabelCatalog;
  messages?: PortalCareCase[];
  onNotes?: (id: string, notes: string) => void;
  onClose?: () => void;
  /** @deprecated drawer is always a slide-over now */
  overlay?: boolean;
}) {
  const [copied, setCopied] = useState('');
  const [notes, setNotes] = useState(row.notes ?? '');
  const [newTag, setNewTag] = useState('');
  const [chotOpen, setChotOpen] = useState(false);
  const [detail, setDetail] = useState<PortalCaseDetail | null>(null);
  const [orders, setOrders] = useState<Array<{ id: string; code: string; status: string; total_vnd: number; created_at: string }>>([]);
  const phone = leadPhone(row);
  const phoneDisplay = formatLeadPhoneDisplay(phone);
  const email = leadEmail(row);
  const page = pages.find((item) => item.page_id === row.page_id);
  const pageLabel = page?.page_name || row.page_id || '—';
  const readOnly = isPortalReadOnly(role);
  const canManage = canManagePortal(role);
  const mine = canActOnCase(role, row.assignee_user_id, userId);
  const answers = row.answers ?? [];
  const linked = useMemo(() => findLinkedConversation(row, messages), [row, messages]);
  const commentHint = useMemo(() => findLinkedCommentHint(row), [row]);
  const when = leadInteractedAt(row);
  const sla = leadSla(row);
  const owner = staffLabel(row.assignee_user_id, row.assignee_email, staffNames);
  const stageIndex = STAGES.indexOf(row.status as (typeof STAGES)[number]);

  useEffect(() => {
    setNotes(row.notes ?? '');
    setChotOpen(false);
    setDetail(null);
  }, [row.id, row.notes]);

  useEffect(() => {
    if (!token || !linked?.id) return;
    let stop = false;
    fetchPortalCase(token, linked.id)
      .then((next) => {
        if (!stop) setDetail(next);
      })
      .catch(() => {
        /* list snippet is enough */
      });
    return () => {
      stop = true;
    };
  }, [token, linked?.id]);

  useEffect(() => {
    if (!token || !phoneDisplay) {
      setOrders([]);
      return;
    }
    let stop = false;
    posGet<{ orders?: typeof orders }>(token, `/api/portal/pos/customers/by-phone?phone=${encodeURIComponent(phoneDisplay)}`)
      .then((res) => {
        if (!stop) setOrders(res.orders ?? []);
      })
      .catch(() => {
        if (!stop) setOrders([]);
      });
    return () => {
      stop = true;
    };
  }, [token, phoneDisplay]);

  async function copy(value: string, kind: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setCopied('');
    }
  }

  function toggleTag(name: string, color = '') {
    const label = name.trim().slice(0, 40);
    if (!label || !mine) return;
    onAct(row.id, 'label', { name: label, color });
  }

  const canMove = mine && row.status !== 'purchased';
  const lastBody = detail?.messages?.slice(-1)[0]?.body || linked?.snippet || '';

  return (
    <aside className="pld" aria-labelledby="pld-title" data-qa="drawer">
      <header className="pld__head">
        <div className="pld__id">
          <PlAvatar name={row.title || 'Lead'} seed={row.id} size="lg" />
          <div className="pld__id-text">
            <p className="pld__kicker">Chi tiết lead</p>
            <h3 id="pld-title" title={row.title || 'Lead'}>
              {row.title || 'Lead'}
            </h3>
            <p className="pld__meta">
              <PlStatus status={row.status} />
              <span className="pld__page">
                <i style={{ background: toneFor(row.page_id) }} />
                {pageLabel}
              </span>
              {sla.tone ? <span className={`pl-sla pl-sla--${sla.tone}`} title={sla.title}>{sla.label}</span> : null}
            </p>
          </div>
          {onClose ? (
            <button type="button" className="pl-iconbtn" onClick={onClose} aria-label="Đóng chi tiết lead" title="Đóng (Esc)" data-qa="drawer-close">
              <PlIcon name="x" />
            </button>
          ) : null}
        </div>

        <ol className="pld__stages" aria-label="Giai đoạn lead">
          {STAGES.map((stage, index) => (
            <li key={stage} className={(index < stageIndex ? 'is-done' : '') + (index === stageIndex ? ' is-on' : '')}>
              <span>{LEAD_STATUS_LABEL[stage]}</span>
            </li>
          ))}
        </ol>

        {readOnly ? (
          <p className="pld__ro">
            <PlIcon name="eye" size={14} /> {VIEWER_READ_ONLY_HINT}
          </p>
        ) : canMove ? (
          <div className="pld__actions">
            {row.status === 'waiting_receive' ? (
              <button type="button" className="pl-btn pl-btn--primary" disabled={busy} onClick={() => onAct(row.id, 'receive')}>
                <PlIcon name="check" /> Nhận lead
              </button>
            ) : null}
            {row.status !== 'caring' ? (
              <button type="button" className={row.status === 'waiting_receive' ? 'pl-btn' : 'pl-btn pl-btn--primary'} disabled={busy} onClick={() => onAct(row.id, 'care')}>
                Đang chăm sóc
              </button>
            ) : null}
            <button
              type="button"
              className={row.status === 'caring' ? 'pl-btn pl-btn--primary' : 'pl-btn'}
              disabled={busy}
              onClick={() => {
                if (!window.confirm('Chuyển lead này sang Mua hàng?')) return;
                onAct(row.id, 'purchase');
              }}
            >
              <PlIcon name="cart" /> Mua hàng
            </button>
            {!row.customer_id ? (
              <button type="button" className="pl-btn" disabled={busy} onClick={() => onAct(row.id, 'customer')}>
                Chuyển thành khách hàng
              </button>
            ) : null}
          </div>
        ) : !mine && row.status !== 'purchased' ? (
          <p className="pld__ro">Chỉ người phụ trách (hoặc chủ tài khoản) mới thao tác lead này.</p>
        ) : null}
      </header>

      <div className="pld__body">
        <Section icon="user" title="Liên hệ & phụ trách">
          <dl className="pld__kv">
            <div>
              <dt>Số điện thoại</dt>
              <dd>
                {phoneDisplay ? (
                  <span className="pld__inline">
                    <a className="pl-phone" href={leadPhoneHref(phone)}>
                      {phoneDisplay}
                    </a>
                    <button type="button" className="pl-iconbtn pl-iconbtn--sm" onClick={() => void copy(phoneDisplay, 'phone')} title="Sao chép SĐT" aria-label="Sao chép SĐT">
                      <PlIcon name={copied === 'phone' ? 'check' : 'copy'} size={14} />
                    </button>
                  </span>
                ) : (
                  <span className="pl-na">Chưa có SĐT</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{email ? <span title={email}>{email}</span> : <span className="pl-na">—</span>}</dd>
            </div>
            <div className="is-wide">
              <dt>Nhân viên phụ trách</dt>
              <dd>
                {canManage && staff.length > 0 ? (
                  <select
                    className="pld__select"
                    value={row.assignee_user_id || ''}
                    disabled={busy}
                    aria-label="Nhân viên phụ trách"
                    onChange={(event) => onAct(row.id, 'assign', { user_id: event.target.value })}
                  >
                    <option value="">Chưa gán</option>
                    {staff.map((item) => (
                      <option key={item.id} value={item.id}>
                        {staffNames[item.id] ? `${staffNames[item.id]} · ${item.email}` : item.email}
                      </option>
                    ))}
                  </select>
                ) : owner ? (
                  <span className="pl-owner">
                    <PlAvatar name={owner} seed={row.assignee_user_id || owner} size="sm" />
                    <span>{owner}</span>
                  </span>
                ) : (
                  <span className="pl-na">Chưa gán</span>
                )}
              </dd>
            </div>
          </dl>
        </Section>

        <Section icon="tag" title="Thẻ">
          <div className="pld__tags">
            {(row.labels ?? []).map((name) => (
              <button
                key={name}
                type="button"
                className="pl-tag pl-tag--btn is-on"
                style={{ ['--tag' as string]: leadTagColor(name, labels) }}
                disabled={busy || !mine}
                onClick={() => toggleTag(name, leadTagColor(name, labels))}
                title={mine ? 'Bỏ thẻ' : undefined}
              >
                {name}
                {mine ? <PlIcon name="x" size={11} /> : null}
              </button>
            ))}
            {mine
              ? labels
                  .filter((item) => !(row.labels ?? []).includes(item.name))
                  .map((item) => (
                    <button
                      key={item.id || item.name}
                      type="button"
                      className="pl-tag pl-tag--btn pl-tag--ghost"
                      style={{ ['--tag' as string]: leadTagColor(item.name, labels) }}
                      disabled={busy}
                      onClick={() => toggleTag(item.name, item.color)}
                    >
                      + {item.name}
                    </button>
                  ))
              : null}
            {!mine && !(row.labels ?? []).length ? <span className="pl-na">Chưa có thẻ</span> : null}
          </div>
          {mine ? (
            <form
              className="pld__tagform"
              onSubmit={(event) => {
                event.preventDefault();
                const name = newTag.trim();
                if (!name) return;
                toggleTag(name);
                setNewTag('');
              }}
            >
              <input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="Thêm thẻ mới…" maxLength={40} />
              <button type="submit" className="pl-btn" disabled={busy || !newTag.trim()}>
                Thêm
              </button>
            </form>
          ) : null}
        </Section>

        <Section icon="chat" title="Hội thoại liên kết">
          {linked ? (
            <div className="pld__conv">
              <p className="pld__conv-title">
                <strong>{linked.title || 'Hội thoại'}</strong>
                <span>{detail?.messages?.length ? `${detail.messages.length} tin nhắn` : ''}</span>
              </p>
              <p className="pld__snippet">{lastBody || 'Đã gắn hội thoại hộp thư.'}</p>
              <Link className="pl-btn" href={`/inbox?open=${encodeURIComponent(linked.id)}`}>
                <PlIcon name="chat" /> Mở hội thoại
              </Link>
            </div>
          ) : commentHint ? (
            <div className="pld__conv">
              <p className="pld__conv-title">
                <strong>Bình luận liên kết</strong>
              </p>
              <p className="pld__snippet">{commentHint.label}</p>
              <Link className="pl-btn" href="/inbox">
                Mở hộp thư bình luận
              </Link>
            </div>
          ) : (
            <p className="pld__muted">Chưa gắn hội thoại hoặc bình luận. Lead từ biểu mẫu quảng cáo thường chưa có tin nhắn.</p>
          )}
        </Section>

        <Section icon="note" title="Ghi chú">
          <textarea
            className="pld__notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={!mine || busy || !onNotes}
            readOnly={!mine}
            placeholder={mine ? 'Ghi chú nội bộ về lead này…' : readOnly ? 'Tài khoản Chỉ xem — không sửa được ghi chú.' : 'Chỉ người phụ trách mới sửa ghi chú.'}
            maxLength={4000}
          />
          {mine && onNotes ? (
            <div className="pld__row-end">
              <button type="button" className="pl-btn" disabled={busy || notes === (row.notes ?? '')} onClick={() => onNotes(row.id, notes)}>
                Lưu ghi chú
              </button>
            </div>
          ) : null}
        </Section>

        <Section icon="form" title="Thông tin biểu mẫu">
          {answers.length === 0 ? (
            <p className="pld__muted">Chưa có câu trả lời form cho lead này.</p>
          ) : (
            <dl className="pld__kv">
              {answers.map((item, index) => (
                <div key={`${item.name}-${index}`}>
                  <dt>{humanizeLeadFieldLabel(item.name)}</dt>
                  <dd>{item.value ? humanizeLeadFieldValue(item.value) : '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>

        <Section icon="link" title="Nguồn">
          <dl className="pld__kv">
            <div>
              <dt>Page</dt>
              <dd>{pageLabel}</dd>
            </div>
            <div>
              <dt>Biểu mẫu</dt>
              <dd>{leadFormLabel(row) || '—'}</dd>
            </div>
            <div>
              <dt>Chiến dịch</dt>
              <dd>{leadSource(row) || row.campaign_id || '—'}</dd>
            </div>
            <div>
              <dt>Nhóm quảng cáo</dt>
              <dd>{row.adset_id || '—'}</dd>
            </div>
            <div>
              <dt>Quảng cáo</dt>
              <dd>{row.ad_id || '—'}</dd>
            </div>
            <div>
              <dt>Thời gian gửi</dt>
              <dd title={leadAgeLabel(when)}>{formatSaigonDateTime(when)}</dd>
            </div>
          </dl>
        </Section>

        <Section icon="cart" title="Đơn hàng" extra={orders.length ? <span className="pld__count">{orders.length}</span> : null}>
          {orders.length === 0 ? (
            <p className="pld__muted">{phoneDisplay ? 'Chưa có đơn hàng.' : 'Cần số điện thoại để xem lịch sử đơn.'}</p>
          ) : (
            <ul className="pld__orders">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/crm/orders/${encodeURIComponent(order.id)}`}>
                    <span>
                      <strong>{order.code}</strong>
                      <small>{POS_STATUS_LABEL[order.status] || order.status}</small>
                    </span>
                    <b>{vnd(order.total_vnd)}</b>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {canMove && token ? (
            chotOpen ? (
              <div className="pld__chot">
                <PortalPosOrderForm
                  token={token}
                  compact
                  confirmOnCreate
                  prefill={{
                    phone: phoneDisplay,
                    name: row.title || '',
                    page_id: row.page_id,
                    case_id: row.id,
                    source: leadSource(row) || 'lead',
                    ad_id: row.ad_id,
                  }}
                  onCreated={(created: PosOrder) => {
                    setOrders((current) => [
                      { id: created.id, code: created.code, status: created.status, total_vnd: created.total_vnd, created_at: created.created_at },
                      ...current,
                    ]);
                  }}
                />
              </div>
            ) : (
              <div className="pld__row-end">
                <button type="button" className="pl-btn pl-btn--primary" onClick={() => setChotOpen(true)} disabled={busy}>
                  <PlIcon name="cart" /> Chốt đơn
                </button>
              </div>
            )
          ) : null}
        </Section>
      </div>
    </aside>
  );
}
