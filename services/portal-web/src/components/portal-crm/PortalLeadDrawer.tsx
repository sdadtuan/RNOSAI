'use client';

import { useState } from 'react';
import type { PortalCareCase, PortalDeskPage } from '@/lib/api';
import {
  formatLeadPhoneDisplay,
  humanizeLeadFieldLabel,
  humanizeLeadFieldValue,
  leadEmail,
  leadInteractedAt,
  leadPhone,
  leadPhoneHref,
  leadSource,
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
    <aside className="portal-lead-panel portal-lead-panel--empty" aria-label="Chi tiết lead">
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

export function PortalLeadPanel({
  row,
  pages,
  staff,
  role,
  userId,
  busy,
  onAct,
}: {
  row: PortalCareCase;
  pages: PortalDeskPage[];
  staff: Array<{ id: string; email: string }>;
  role: string;
  userId: string;
  busy: boolean;
  onAct: (id: string, action: string, body?: Record<string, string>) => void;
}) {
  const [copied, setCopied] = useState('');
  const phone = leadPhone(row);
  const phoneDisplay = formatLeadPhoneDisplay(phone);
  const email = leadEmail(row);
  const page = pages.find((item) => item.page_id === row.page_id);
  const pageLabel = page?.page_name || row.page_id || '—';
  const canManage = role !== 'staff';
  const mine = role !== 'staff' || row.assignee_user_id === userId;
  const answers = row.answers ?? [];

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

  return (
    <aside className="portal-lead-panel" aria-labelledby="portal-lead-panel-title">
      <header className="portal-drawer__head">
        <div className="portal-drawer__head-row">
          <div>
            <p className="portal-drawer__kicker">Chi tiết lead</p>
            <h3 id="portal-lead-panel-title">{row.title || 'Lead'}</h3>
          </div>
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
          <h4>Thông tin form</h4>
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
              <dt>Form</dt>
              <dd>{leadSource(row) || '—'}</dd>
            </div>
            <div className="portal-kv">
              <dt>Campaign</dt>
              <dd>{row.campaign_id || '—'}</dd>
            </div>
            <div className="portal-kv">
              <dt>Ad set</dt>
              <dd>{row.adset_id || '—'}</dd>
            </div>
            <div className="portal-kv">
              <dt>Ad</dt>
              <dd>{row.ad_id || '—'}</dd>
            </div>
            <div className="portal-kv">
              <dt>Thời gian gửi</dt>
              <dd>{formatSaigonDateTime(leadInteractedAt(row))}</dd>
            </div>
          </dl>
        </section>

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