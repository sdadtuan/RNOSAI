'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
  leadInteractedAt,
  leadPhone,
  leadPhoneHref,
  leadSource,
  leadTagColor,
} from '@/lib/portal/portal-leads-table.util';

export const LEAD_STATUS_LABEL: Record<string, string> = {
  waiting_receive: 'Chờ nhận',
  received: 'Đã nhận',
  caring: 'Đang chăm sóc',
  purchased: 'Mua hàng',
};

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

function EmptyMark() {
  return <span className="portal-leads__na">—</span>;
}

export function PortalLeadEmptyPanel({ loading = false }: { loading?: boolean }) {
  return (
    <aside className="portal-lead-panel portal-lead-panel--empty portal-lead-panel--pk" aria-label="Chi tiết lead">
      <header className="portal-drawer__head">
        <p className="portal-drawer__kicker">Chi tiết lead</p>
        <h3>{loading ? 'Đang tải…' : 'Chưa có lead'}</h3>
      </header>
      <div className="portal-drawer__body">
        <p className="muted">
          {loading
            ? 'Đang tải chi tiết lead.'
            : 'Không có lead để hiển thị. Khi có lead trên Page đang gắn, thông tin form và thao tác sẽ hiện ở cột này.'}
        </p>
      </div>
    </aside>
  );
}

export type LeadLabelCatalog = Array<{ id: string; name: string; color: string }>;

export function PortalLeadPanel({
  row,
  pages,
  staff,
  role,
  userId,
  busy,
  onAct,
  token,
  labels = [],
  messages = [],
  onNotes,
  onClose,
  overlay = false,
}: {
  row: PortalCareCase;
  pages: PortalDeskPage[];
  staff: Array<{ id: string; email: string }>;
  role: string;
  userId: string;
  busy: boolean;
  onAct: (id: string, action: string, body?: Record<string, string>) => void;
  token?: string;
  labels?: LeadLabelCatalog;
  messages?: PortalCareCase[];
  onNotes?: (id: string, notes: string) => void;
  onClose?: () => void;
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
  const canManage = role !== 'staff';
  const mine = role !== 'staff' || row.assignee_user_id === userId;
  const answers = row.answers ?? [];
  const linked = useMemo(() => findLinkedConversation(row, messages), [row, messages]);
  const commentHint = useMemo(() => findLinkedCommentHint(row), [row]);

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

  return (
    <aside className={overlay ? "portal-lead-panel portal-lead-panel--pk is-overlay" : "portal-lead-panel portal-lead-panel--pk"} aria-labelledby="portal-lead-panel-title">
      <header className="portal-drawer__head">
        <div className="portal-drawer__head-row">
          <div>
            <p className="portal-drawer__kicker">Chi tiết lead</p>
            <h3 id="portal-lead-panel-title">{row.title || 'Lead'}</h3>
          </div>
          {onClose ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Đóng chi tiết lead">
              Đóng
            </button>
          ) : null}
        </div>
        <div className="portal-drawer__meta">
          <span className={leadStatusChipClass(row.status)}>{LEAD_STATUS_LABEL[row.status] || row.status}</span>
          {phoneDisplay ? (
            <a className="portal-phone-link" href={leadPhoneHref(phone)}>
              {phoneDisplay}
            </a>
          ) : (
            <span className="muted">Chưa có SĐT</span>
          )}
          {email ? <span className="muted">{email}</span> : <EmptyMark />}
        </div>
        {canManage && staff.length > 0 ? (
          <label className="portal-drawer__assign">
            Nhân viên phụ trách
            <select
              value={row.assignee_user_id || ''}
              disabled={busy}
              onChange={(event) => {
                const user_id = event.target.value;
                if (user_id) onAct(row.id, 'assign', { user_id });
              }}
            >
              <option value="">Chưa gán</option>
              {staff.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.email}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="muted">Phụ trách: {row.assignee_email || 'Chưa gán'}</p>
        )}
      </header>

      <div className="portal-drawer__body">
        <section>
          <h4>Thẻ</h4>
          <div className="portal-leads-pk__tags">
            {(row.labels ?? []).map((name) => (
              <button
                key={name}
                type="button"
                className="portal-leads-pk__tag is-btn is-on"
                style={{ background: leadTagColor(name, labels) }}
                disabled={busy || !mine}
                onClick={() => toggleTag(name, leadTagColor(name, labels))}
                title="Bỏ thẻ"
              >
                {name}
              </button>
            ))}
            {labels
              .filter((item) => !(row.labels ?? []).includes(item.name))
              .map((item) => (
                <button
                  key={item.id || item.name}
                  type="button"
                  className="portal-leads-pk__tag is-btn is-ghost"
                  disabled={busy || !mine}
                  onClick={() => toggleTag(item.name, item.color)}
                >
                  + {item.name}
                </button>
              ))}
          </div>
          {mine ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const name = newTag.trim();
                if (!name) return;
                toggleTag(name);
                setNewTag('');
              }}
              style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}
            >
              <input
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
                placeholder="Thêm thẻ mới"
                maxLength={40}
                style={{ flex: 1, font: 'inherit', fontSize: '0.8125rem', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.35rem 0.5rem' }}
              />
              <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !newTag.trim()}>
                Thêm
              </button>
            </form>
          ) : null}
        </section>

        <section>
          <h4>Hội thoại liên kết</h4>
          {linked ? (
            <div className="portal-leads-pk__conv">
              <p>
                <strong>{linked.title || 'Hội thoại'}</strong>
              </p>
              <p className="snippet">{detail?.messages?.slice(-1)[0]?.body || linked.snippet || 'Đã gắn hội thoại hộp thư.'}</p>
              <p className="muted" style={{ fontSize: '0.75rem' }}>
                {detail?.messages?.length ? `${detail.messages.length} tin nhắn` : 'Mở hộp thư để xem đầy đủ.'}
              </p>
              <Link className="btn btn-sm" href={`/inbox?open=${encodeURIComponent(linked.id)}`}>
                Mở hội thoại
              </Link>
            </div>
          ) : commentHint ? (
            <div className="portal-leads-pk__conv">
              <p>
                <strong>Bình luận liên kết</strong>
              </p>
              <p className="snippet">{commentHint.label}</p>
              <p className="muted" style={{ fontSize: '0.75rem' }}>
                Lead được tạo từ bình luận. Không gửi hay ẩn bình luận từ trang này.
              </p>
              <Link className="btn btn-secondary btn-sm" href="/inbox">
                Mở hộp thư bình luận
              </Link>
            </div>
          ) : (
            <p className="muted">Chưa gắn hội thoại hoặc bình luận. Lead từ biểu mẫu quảng cáo thường chưa có tin nhắn.</p>
          )}
        </section>

        <section>
          <h4>Ghi chú</h4>
          <textarea
            className="portal-leads-pk__notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={!mine || busy || !onNotes}
            placeholder={mine ? 'Ghi chú nội bộ về lead này…' : 'Chỉ người phụ trách mới sửa ghi chú.'}
            maxLength={4000}
          />
          {mine && onNotes ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy || notes === (row.notes ?? '')}
              onClick={() => onNotes(row.id, notes)}
            >
              Lưu ghi chú
            </button>
          ) : null}
        </section>

        <section>
          <h4>Thông tin biểu mẫu</h4>
          {answers.length === 0 ? (
            <p className="muted">Chưa có câu trả lời form cho lead này.</p>
          ) : (
            <dl className="portal-kv-grid">
              {answers.map((item, index) => (
                <div key={`${item.name}-${index}`} className="portal-kv">
                  <dt>{humanizeLeadFieldLabel(item.name)}</dt>
                  <dd>{item.value ? humanizeLeadFieldValue(item.value) : '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section>
          <h4>Nguồn</h4>
          <dl className="portal-kv-grid">
            <div className="portal-kv">
              <dt>Page</dt>
              <dd>{pageLabel}</dd>
            </div>
            <div className="portal-kv">
              <dt>Biểu mẫu</dt>
              <dd>{leadSource(row) || '—'}</dd>
            </div>
            <div className="portal-kv">
              <dt>Chiến dịch</dt>
              <dd>{row.campaign_id || '—'}</dd>
            </div>
            <div className="portal-kv">
              <dt>Nhóm quảng cáo</dt>
              <dd>{row.adset_id || '—'}</dd>
            </div>
            <div className="portal-kv">
              <dt>Quảng cáo</dt>
              <dd>{row.ad_id || '—'}</dd>
            </div>
            <div className="portal-kv">
              <dt>Thời gian gửi</dt>
              <dd>{formatSaigonDateTime(leadInteractedAt(row))}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h4>Đơn hàng</h4>
          {orders.length === 0 ? (
            <p className="muted">{phoneDisplay ? 'Chưa có đơn hàng.' : 'Cần số điện thoại để xem lịch sử đơn.'}</p>
          ) : (
            <ul className="portal-leads-pk__order-list">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/crm/orders/${encodeURIComponent(order.id)}`}>
                    <span>
                      <strong>{order.code}</strong>{' '}
                      <span className="muted">{POS_STATUS_LABEL[order.status] || order.status}</span>
                    </span>
                    <span>{vnd(order.total_vnd)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {mine && row.status !== 'purchased' && token ? (
          <section>
            <h4>Chốt đơn</h4>
            {chotOpen ? (
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
                    {
                      id: created.id,
                      code: created.code,
                      status: created.status,
                      total_vnd: created.total_vnd,
                      created_at: created.created_at,
                    },
                    ...current,
                  ]);
                }}
              />
            ) : (
              <button type="button" className="btn btn-sm" onClick={() => setChotOpen(true)} disabled={busy}>
                Chốt đơn
              </button>
            )}
          </section>
        ) : null}

        {mine && row.status !== 'purchased' ? (
          <section>
            <h4>Thao tác</h4>
            <div className="portal-drawer__actions">
              {phoneDisplay ? (
                <>
                  <a className="btn btn-sm" href={leadPhoneHref(phone)}>
                    Gọi
                  </a>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy(phoneDisplay, 'phone')}>
                    {copied === 'phone' ? 'Đã chép SĐT' : 'Sao chép SĐT'}
                  </button>
                </>
              ) : null}
              {row.status === 'waiting_receive' ? (
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onAct(row.id, 'receive')}>
                  Nhận lead
                </button>
              ) : null}
              {row.status !== 'caring' ? (
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onAct(row.id, 'care')}>
                  Đang chăm sóc
                </button>
              ) : null}
              {!row.customer_id ? (
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onAct(row.id, 'customer')}>
                  Chuyển thành khách hàng
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
