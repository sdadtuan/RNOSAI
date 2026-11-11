'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PortalPageShell } from '@/components/PortalPageShell';
import {
  PortalProductRow,
  portalProductFromList,
  resolvePortalProductImage,
} from '@/components/portal-crm/PortalProductRow';
import {
  fetchPortalCase,
  fetchPortalDesk,
  postPortalCase,
  postPortalPage,
  type PortalCareCase,
  type PortalCaseDetail,
  type PortalDesk,
} from '@/lib/api';
import {
  mergeCaseMessages,
  mergeDeskMessages,
  PORTAL_CRM_DESK_POLL_MS,
  saigonRefreshLabel,
} from '@/components/portal-crm/portal-crm-refresh.util';
import { PortalLeadsTable } from '@/components/portal-crm/PortalLeadsTable';

export type CrmView = 'leads' | 'messages' | 'customers';

export type CustomerSourceFilter = 'lead' | 'message';

const STATUS: Record<string, string> = {
  waiting_receive: 'Chờ nhận',
  received: 'Đã nhận',
  caring: 'Đang chăm sóc',
  purchased: 'Mua hàng',
};

const CUSTOMER_RECENT_MS = 7 * 24 * 60 * 60 * 1000;

function isWithinLastDays(iso: string | undefined, windowMs: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now() - windowMs;
}

function when(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function portalInboxAlerts(inbox: PortalDesk['inbox'], pageCount: number): string[] {
  if (!inbox || pageCount === 0) return [];
  const out: string[] = [];
  if (inbox.withToken === 0) {
    out.push('Page đã gắn. Token Business Manager chưa đọc được Lead và tin nhắn của Page này.');
  }
  if (inbox.error?.trim()) out.push(inbox.error.trim());
  if (inbox.leadNote?.trim()) out.push(inbox.leadNote.trim());
  if (inbox.messageNote?.trim()) out.push(inbox.messageNote.trim());
  return [...new Set(out)];
}

function PortalInboxBanner({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div
      className="portal-crm__note"
      role="alert"
      style={{
        padding: '0.65rem 0.85rem',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 'var(--radius-md)',
        color: '#b91c1c',
        fontSize: '0.875rem',
        fontWeight: 600,
      }}
    >
      {lines.map((line) => (
        <p key={line} style={{ margin: lines.length > 1 ? '0.25rem 0' : 0 }}>
          {line}
        </p>
      ))}
    </div>
  );
}

export function CrmScreen({
  view,
  initialCustomerSource,
}: {
  view: CrmView;
  initialCustomerSource?: CustomerSourceFilter;
}) {
  const title =
    view === 'leads' ? 'Lead' : view === 'messages' ? 'Tin nhắn' : 'Khách hàng';
  return (
    <PortalPageShell breadcrumb={[{ label: 'Client Portal', href: '/crm' }, { label: title }]}>
      {({ token, user }) => (
        <CrmBody
          token={token}
          role={user.role}
          userId={user.id}
          view={view}
          initialCustomerSource={initialCustomerSource}
        />
      )}
    </PortalPageShell>
  );
}

function CrmBody({
  token,
  role,
  userId,
  view,
  initialCustomerSource,
}: {
  token: string;
  role: string;
  userId: string;
  view: CrmView;
  initialCustomerSource?: CustomerSourceFilter;
}) {
  const [desk, setDesk] = useState<PortalDesk | null>(null);
  const [detail, setDetail] = useState<PortalCaseDetail | null>(null);
  const [pageId, setPageId] = useState('');
  const [product, setProduct] = useState({ name: '', image_url: '', detail: '' });
  const [customerSource, setCustomerSource] = useState<CustomerSourceFilter | ''>(initialCustomerSource ?? '');
  const [customerRecent7d, setCustomerRecent7d] = useState(false);
  const [error, setError] = useState('');
  const [syncNote, setSyncNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  useEffect(() => {
    setCustomerSource(initialCustomerSource ?? '');
  }, [initialCustomerSource]);

  const load = useCallback(async () => {
    const data = await fetchPortalDesk(token, {});
    setDesk((current) => (current ? mergeDeskMessages(current, data) : data));
    setRefreshedAt(new Date());
  }, [token]);

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được CRM'));
  }, [load]);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let flying = false;
    const schedule = (delay: number) => {
      if (stopped) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void tick(), delay);
    };
    const tick = async () => {
      if (stopped || document.hidden) {
        schedule(PORTAL_CRM_DESK_POLL_MS);
        return;
      }
      if (flying) {
        schedule(PORTAL_CRM_DESK_POLL_MS);
        return;
      }
      flying = true;
      try {
        const data = await fetchPortalDesk(token, {});
        if (stopped) return;
        setDesk((current) => (current ? mergeDeskMessages(current, data) : data));
        setRefreshedAt(new Date());
        const openId = detail?.case.id;
        if (openId) {
          const nextDetail = await fetchPortalCase(token, openId);
          if (!stopped) {
            setDetail((current) =>
              current && current.case.id === openId
                ? { ...nextDetail, messages: mergeCaseMessages(current.messages, nextDetail.messages) }
                : nextDetail,
            );
          }
        }
        schedule(PORTAL_CRM_DESK_POLL_MS);
      } catch {
        schedule(PORTAL_CRM_DESK_POLL_MS * 1.5);
      } finally {
        flying = false;
      }
    };
    schedule(PORTAL_CRM_DESK_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) schedule(400);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, detail?.case.id]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được');
    } finally {
      setBusy(false);
    }
  }

  const pages = (desk?.pages ?? []).filter((page) => page.channel !== 'ad_account');
  const activePage = pages.find((page) => page.page_id === pageId) ?? null;
  const pageName = new Map(pages.map((page) => [page.page_id, page.page_name || page.page_id]));
  const rows = (
    view === 'leads'
      ? desk?.leads ?? []
      : view === 'messages'
        ? desk?.messages ?? []
        : (desk?.customers ?? []).filter((row) => {
            if (customerSource && row.kind !== customerSource) return false;
            if (customerRecent7d && !isWithinLastDays(row.last_interaction_at, CUSTOMER_RECENT_MS)) return false;
            return true;
          })
  ).filter((row) => !pageId || row.page_id === pageId);
  const products = (desk?.products ?? []).filter(
    (item) => (!pageId || item.page_id === pageId) && item.active !== false,
  );
  const canManage = role !== 'staff';
  const canSyncInbox = role === 'approver';
  const showProductTools = view === 'messages';

  if (view === 'leads') {
    return (
      <div className="portal-crm">
        {error ? <p className="error">{error}</p> : null}
        <PortalInboxBanner lines={portalInboxAlerts(desk?.inbox, pages.length)} />
        <header className="portal-crm__head">
          <div>
            <h2>Lead</h2>
            <p>Danh sách lead trên Page đang gắn. Dữ liệu Page cũ vẫn được giữ, không hiện ở đây.</p>
            {refreshedAt ? <p className="muted">Cập nhật lúc {saigonRefreshLabel(refreshedAt)}</p> : null}
            {syncNote ? <p className="muted">{syncNote}</p> : null}
          </div>
        </header>
        <PortalLeadsTable
          rows={desk?.leads ?? []}
          pages={pages}
          staff={desk?.staff ?? []}
          role={role}
          userId={userId}
          busy={busy}
          loading={!desk && !error}
          error={error}
          onOpen={async (id) => {
            setDetail(await fetchPortalCase(token, id));
          }}
          onAct={(id, action, body) => void run(() => postPortalCase(token, id, action, body))}
        />
      </div>
    );
  }

  return (
    <div className="portal-crm portal-crm__grid">
      <aside className="portal-crm__pages">
        <h2>Page đang nhận</h2>
        {desk && pages.length === 0 ? <p className="muted">Chưa gắn Page từ Kênh ads.</p> : null}
        {pages.map((page) => (
          <button
            key={page.page_id}
            type="button"
            className={page.page_id === pageId ? 'portal-crm__page is-active' : 'portal-crm__page'}
            onClick={() => {
              setPageId(page.page_id === pageId ? '' : page.page_id);
              setDetail(null);
            }}
          >
            <strong>{page.page_name || 'Page'}</strong>
            <span>Page ID {page.page_id}</span>
          </button>
        ))}
      </aside>
      <div className="portal-crm__main">
        {error ? <p className="error">{error}</p> : null}
        <PortalInboxBanner lines={portalInboxAlerts(desk?.inbox, pages.length)} />
        <header className="portal-crm__head">
          <div>
            <h2>{activePage ? activePage.page_name || 'Page' : `Tất cả Page (${pages.length})`}</h2>
            <p>{activePage ? `Page ID ${activePage.page_id}` : 'Bấm một Page để xem riêng Page đó.'}</p>
            {refreshedAt ? <p className="muted">Cập nhật lúc {saigonRefreshLabel(refreshedAt)}</p> : null}
            {syncNote ? <p className="muted">{syncNote}</p> : null}
          </div>
          {canSyncInbox && activePage && activePage.channel === 'facebook' ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setSyncNote('');
                  const out = (await postPortalPage(token, activePage.page_id, 'sync', {})) as {
                    has_more?: boolean;
                    leads?: number;
                    messages?: number;
                  };
                  if (out?.has_more) {
                    setSyncNote(
                      `Đã kéo ${out.leads ?? 0} lead, ${out.messages ?? 0} tin. Còn lịch sử — bấm Đồng bộ lần nữa để tiếp.`,
                    );
                  } else {
                    setSyncNote(`Đồng bộ xong (${out?.leads ?? 0} lead, ${out?.messages ?? 0} tin nhắn mới trong lượt này).`);
                  }
                })
              }
            >
              {busy ? 'Đang đồng bộ…' : 'Đồng bộ'}
            </button>
          ) : null}
        </header>
        {view === 'customers' ? (
          <div className="portal-crm__filters">
            <div className="portal-crm__filter" role="group" aria-label="Lọc nguồn khách hàng">
              <button
                type="button"
                className={!customerSource ? 'btn btn-sm is-active' : 'btn btn-secondary btn-sm'}
                onClick={() => setCustomerSource('')}
              >
                Tất cả
              </button>
              <button
                type="button"
                className={customerSource === 'lead' ? 'btn btn-sm is-active' : 'btn btn-secondary btn-sm'}
                onClick={() => setCustomerSource('lead')}
              >
                Lead
              </button>
              <button
                type="button"
                className={customerSource === 'message' ? 'btn btn-sm is-active' : 'btn btn-secondary btn-sm'}
                onClick={() => setCustomerSource('message')}
              >
                Mess
              </button>
            </div>
            <div className="portal-crm__filter" role="group" aria-label="Lọc thời gian tương tác">
              <button
                type="button"
                className={!customerRecent7d ? 'btn btn-sm is-active' : 'btn btn-secondary btn-sm'}
                onClick={() => setCustomerRecent7d(false)}
              >
                Mọi thời điểm
              </button>
              <button
                type="button"
                className={customerRecent7d ? 'btn btn-sm is-active' : 'btn btn-secondary btn-sm'}
                onClick={() => setCustomerRecent7d(true)}
              >
                7 ngày gần đây
              </button>
            </div>
          </div>
        ) : null}
        {showProductTools && canManage && activePage ? (
          <p className="muted">
            <Link href={`/products?page_id=${encodeURIComponent(activePage.page_id)}`}>Quản lý sản phẩm Page này</Link>
            {' · '}
            <Link href="/products">Mở Sản Phẩm</Link>
          </p>
        ) : null}
        {showProductTools && canManage && pages.length > 0 ? (
          <form
            className="portal-crm__staff"
            onSubmit={(event) => {
              event.preventDefault();
              const target = activePage ?? pages[0];
              if (!target) return;
              void run(async () => {
                await postPortalPage(token, target.page_id, 'products', product);
                setProduct({ name: '', image_url: '', detail: '' });
              });
            }}
          >
            <input
              value={product.name}
              onChange={(event) => setProduct((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Tên sản phẩm"
              required
            />
            <input
              value={product.image_url}
              onChange={(event) => setProduct((prev) => ({ ...prev, image_url: event.target.value }))}
              placeholder="Link ảnh https"
            />
            <input
              value={product.detail}
              onChange={(event) => setProduct((prev) => ({ ...prev, detail: event.target.value }))}
              placeholder="Mô tả"
            />
            <button className="btn btn-sm" type="submit" disabled={busy}>
              Thêm sản phẩm vào {activePage?.page_name || pages[0]?.page_name || 'Page'}
            </button>
          </form>
        ) : null}
        {showProductTools && products.length > 0 ? (
          <div className="portal-crm__products">
            {products.map((item) => (
              <article key={item.id}>
                {item.image_url ? <img src={item.image_url} alt="" /> : null}
                <strong>{item.name}</strong>
                <span>{pageName.get(item.page_id) || item.page_id}</span>
              </article>
            ))}
          </div>
        ) : showProductTools && activePage && canManage ? (
          <p className="muted">Page này chưa có sản phẩm.</p>
        ) : null}
        <CaseList
          rows={rows}
          pageName={pageName}
          showLastInteraction={view === 'customers'}
          empty={
            pages.length === 0
              ? 'Chưa gắn Page từ Kênh ads.'
              : view === 'customers'
                ? 'Chưa có khách hàng trên Page đang nhận.'
                : 'Page đã gắn. Chưa có mục nào trên Page này.'
          }
          showCustomer={view === 'messages'}
          me={userId}
          role={role}
          staff={desk?.staff ?? []}
          labels={desk?.labels ?? []}
          busy={busy}
          allowPurchase={view === 'messages'}
          onOpen={async (id) => {
            setDetail(await fetchPortalCase(token, id));
          }}
          onAct={(id, action, body) => void run(() => postPortalCase(token, id, action, body))}
        />
      {detail && view === 'messages' ? (
        <div className="portal-mess">
          <div className="portal-mess__thread">
            {detail.messages.map((msg) => (
              <article key={msg.id} className={msg.direction === 'out' ? 'portal-mess__bubble is-out' : 'portal-mess__bubble'}>
                <header>
                  <strong>{msg.direction === 'out' ? 'Nhân viên' : msg.sender_name || 'Khách'}</strong>
                  <time>{when(msg.received_at)}</time>
                </header>
                <p>{msg.body}</p>
              </article>
            ))}
          </div>
          <div className="portal-product-row-stack">
            {detail.products
              .filter((item) => item.page_id === detail.case.page_id && item.active !== false)
              .map((item) => {
                const canAct = role !== 'staff' || detail.case.assignee_user_id === userId;
                return (
                  <PortalProductRow
                    key={item.id}
                    name={item.name}
                    imageUrl={resolvePortalProductImage(item)}
                    priceVnd={item.spec?.price_vnd}
                    footer={
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busy || !canAct}
                        onClick={() =>
                          void run(async () => {
                            await postPortalCase(token, detail.case.id, 'send-product', { product_id: item.id });
                            setDetail(await fetchPortalCase(token, detail.case.id));
                          })
                        }
                      >
                        Gửi cho khách
                      </button>
                    }
                  />
                );
              })}
          </div>
        </div>
      ) : null}
      {detail && view === 'customers' ? (
        <div className="portal-crm__customer-product">
          <h3>Sản phẩm quan tâm</h3>
          {detail.case.order?.product_id ? (
            <PortalProductRow
              name={detail.case.order.product_name}
              imageUrl={resolvePortalProductImage(portalProductFromList(detail.products, detail.case.order.product_id), detail.case.order.color)}
              priceVnd={detail.case.order.price_vnd}
              variantLine={[detail.case.order.color, detail.case.order.size].filter(Boolean).join(' · ') || undefined}
              confirmedHighlight
            />
          ) : (
            <p className="muted">Chưa có sản phẩm quan tâm.</p>
          )}
        </div>
      ) : null}
      </div>
    </div>
  );
}

function CaseList({
  rows,
  pageName,
  empty,
  showCustomer,
  showLastInteraction,
  me,
  role,
  staff,
  labels,
  busy,
  allowPurchase,
  onOpen,
  onAct,
}: {
  rows: PortalCareCase[];
  pageName: Map<string, string>;
  empty: string;
  showCustomer: boolean;
  showLastInteraction?: boolean;
  me: string;
  role: string;
  staff: Array<{ id: string; email: string }>;
  labels: Array<{ id: string; name: string; color: string }>;
  busy: boolean;
  allowPurchase: boolean;
  onOpen: (id: string) => Promise<void>;
  onAct: (id: string, action: string, body?: Record<string, string>) => void;
}) {
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  return (
    <ul className="portal-crm__list">
      {rows.map((row) => {
        const mine = role !== 'staff' || row.assignee_user_id === me;
        return (
          <li key={row.id}>
            <div>
              <button type="button" className="portal-crm__case" onClick={() => void onOpen(row.id)}>
                <strong>{row.title || 'Khách'}</strong>
              </button>
              <span className="muted">
                {pageName.get(row.page_id) || row.page_id}
                {' · '}
                {STATUS[row.status] || row.status}
                {row.order?.product_name ? ` · ${row.order.product_name}${row.order.size ? ` / ${row.order.size}` : ''}` : ''}
                {showLastInteraction
                  ? ` · Tương tác gần nhất: ${row.last_interaction_at ? when(row.last_interaction_at) : '—'}`
                  : ''}
              </span>
              {row.order?.phone || row.order?.address ? (
                <span className="muted">{[row.order.phone, row.order.address].filter(Boolean).join(' · ')}</span>
              ) : null}
            </div>
            {mine && row.status !== 'purchased' ? (
              <span className="portal-crm__actions">
                {role !== 'staff' && staff.length > 0 ? (
                  <label className="portal-crm__assign">
                    <span className="sr-only">Gán cho</span>
                    <select
                      value={row.assignee_user_id || ''}
                      disabled={busy}
                      aria-label="Gán cho"
                      onChange={(event) => {
                        const user_id = event.target.value;
                        if (user_id) onAct(row.id, 'assign', { user_id });
                      }}
                    >
                      <option value="">Gán cho…</option>
                      {staff.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.email}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {row.status === 'waiting_receive' ? (
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onAct(row.id, 'receive')}>Nhận</button>
                ) : null}
                {row.status !== 'caring' ? (
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onAct(row.id, 'care')}>Xác nhận chăm sóc</button>
                ) : allowPurchase ? (
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onAct(row.id, 'purchase')}>Mua hàng</button>
                ) : null}
                {showCustomer && !row.customer_id ? (
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onAct(row.id, 'customer')}>Khách hàng</button>
                ) : null}
                {labels.map((item) => (
                  <button key={item.id} type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onAct(row.id, 'label', { name: item.name })}>
                    {item.name}
                  </button>
                ))}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
