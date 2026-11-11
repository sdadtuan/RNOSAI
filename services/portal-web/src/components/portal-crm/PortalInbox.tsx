'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PortalPageShell } from '@/components/PortalPageShell';
import {
  fetchPortalCase,
  fetchPortalDesk,
  fetchPortalLive,
  postPortalCase,
  type PortalCaseDetail,
  type PortalDesk,
  type PortalOrderDraft,
  type PortalProductRecord,
} from '@/lib/api';
import {
  PortalProductRow,
  portalProductFromList,
  resolvePortalProductImage,
} from '@/components/portal-crm/PortalProductRow';
import {
  mergeCareCases,
  mergeCaseMessages,
  mergeDeskMessages,
  PORTAL_CRM_DESK_POLL_MS,
  saigonRefreshLabel,
} from '@/components/portal-crm/portal-crm-refresh.util';

const ADDRESS = /địa chỉ|dia chi|phường|quận|huyện|thành phố|tp\.|tỉnh/i;
const STATUS: Record<string, string> = {
  waiting_receive: 'Chờ nhận',
  received: 'Đã nhận',
  caring: 'Đang chăm sóc',
  purchased: 'Mua hàng',
};

function scanContact(text: string): { phone: string | null; address: string | null } {
  const phone = text.match(/(?:\+84|0)\d{8,10}/)?.[0] ?? null;
  const line = text
    .split(/\n/)
    .map((part) => part.trim())
    .reverse()
    .find((part) => ADDRESS.test(part));
  return { phone, address: line ? line.replace(/\s+/g, ' ').slice(0, 90) : null };
}

function when(value: string): string {
  if (!value) return 'Không có mốc thời gian';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không có mốc thời gian';
  return date.toLocaleString('vi-VN');
}

function inboxIngestAlerts(inbox: PortalDesk['inbox'], pageCount: number): string[] {
  if (!inbox || pageCount === 0) return [];
  const out: string[] = [];
  if (inbox.withToken === 0) {
    out.push('Page đã gắn. Token Business Manager chưa đọc được tin nhắn của Page này.');
  }
  if (inbox.error?.trim()) out.push(inbox.error.trim());
  if (inbox.messageNote?.trim()) out.push(inbox.messageNote.trim());
  if (inbox.leadNote?.trim()) out.push(inbox.leadNote.trim());
  return [...new Set(out)];
}

export function PortalInbox() {
  return (
    <PortalPageShell breadcrumb={[{ label: 'Client Portal', href: '/crm' }, { label: 'Tin nhắn' }]}>
      {({ token }) => <InboxBody token={token} />}
    </PortalPageShell>
  );
}

function InboxBody({ token }: { token: string }) {
  const [desk, setDesk] = useState<PortalDesk | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<PortalCaseDetail | null>(null);
  const [query, setQuery] = useState('');
  const [pageId, setPageId] = useState('');
  const [info, setInfo] = useState('');
  const [contact, setContact] = useState({ id: '', phone: '', address: '' });
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const data = await fetchPortalDesk(token, {});
    setDesk((current) => (current ? mergeDeskMessages(current, data) : data));
    setRefreshedAt(new Date());
  }, [token]);

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được hộp thư'));
  }, [load]);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let flying = false;
    let burst = 0;
    let since = new Date(Date.now() - 3000).toISOString();
    const seen = new Set<string>();
    const schedule = (delay: number) => {
      if (stopped) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void tick(), delay);
    };
    const tick = async () => {
      if (stopped || document.hidden) {
        schedule(document.hidden ? 20000 : 5000);
        return;
      }
      if (flying) {
        schedule(5000);
        return;
      }
      flying = true;
      try {
        const data = await fetchPortalLive(token, since);
        if (stopped) return;
        const fresh = data.messages.filter((row) => row.id && !seen.has(row.id));
        for (const row of data.messages) if (row.id) seen.add(row.id);
        if (seen.size > 400) {
          for (const id of [...seen].slice(0, seen.size - 200)) seen.delete(id);
        }
        const last = data.messages.at(-1)?.received_at;
        if (last) since = fresh.length ? last : new Date(new Date(last).getTime() + 1).toISOString();
        if (fresh.length || data.cases.length) {
          setDesk((current) => {
            if (!current || !data.cases.length) return current;
            return { ...current, messages: mergeCareCases(current.messages, data.cases) };
          });
          setRefreshedAt(new Date());
          setDetail((current) => {
            if (!current || !fresh.length) return current;
            const title = current.case.title.toLowerCase();
            const extra = fresh.filter((row) => row.page_id === current.case.page_id && row.sender_name.toLowerCase() === title && !current.messages.some((item) => item.id === row.id));
            if (!extra.length) return current;
            return { ...current, messages: [...current.messages, ...extra] };
          });
        }
        schedule(fresh.length >= 40 && burst < 3 ? (burst += 1, 400) : (burst = 0, 5000));
      } catch {
        schedule(8000);
      } finally {
        flying = false;
      }
    };
    schedule(4000);
    const onVisible = () => {
      if (!document.hidden) schedule(300);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token]);

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
        if (selectedId) {
          const nextDetail = await fetchPortalCase(token, selectedId);
          if (!stopped) {
            setDetail((current) =>
              current && current.case.id === selectedId
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
  }, [token, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void fetchPortalCase(token, selectedId)
      .then(setDetail)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không mở được hội thoại'));
  }, [token, selectedId]);

  const pages = (desk?.pages ?? []).filter((page) => page.channel !== 'ad_account');
  const pageName = new Map(pages.map((page) => [page.page_id, page.page_name || page.page_id]));
  const threads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (desk?.messages ?? []).filter((row) => {
      if (pageId && row.page_id !== pageId) return false;
      const contact = scanContact(row.snippet || '');
      if (info === 'phone' && !contact.phone) return false;
      if (info === 'address' && !contact.address) return false;
      if (info === 'any' && !contact.phone && !contact.address) return false;
      if (!needle) return true;
      const blob = `${row.title} ${row.page_id} ${pageName.get(row.page_id) || ''} ${row.assignee_email || ''} ${row.snippet || ''}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [desk, query, pageId, info, pageName]);

  const products = (desk?.products ?? []).filter(
    (item) => detail && item.page_id === detail.case.page_id && item.active !== false,
  );
  const canActProducts =
    Boolean(detail) &&
    (desk?.me.role !== 'staff' || detail?.case.assignee_user_id === desk?.me.id) &&
    detail?.case.status !== 'purchased';
  const threadText = (detail?.messages ?? []).filter((msg) => msg.direction !== 'out').map((msg) => msg.body).join('\n');
  const scanned = scanContact(`${detail?.case.snippet || ''}\n${threadText}`);
  const form = detail && contact.id === detail.case.id
    ? contact
    : {
        id: detail?.case.id ?? '',
        phone: detail?.case.order?.phone || scanned.phone || '',
        address: detail?.case.order?.address || scanned.address || '',
      };
  const order = detail?.case.order;
  const canClose = Boolean(form.phone.trim() && form.address.trim());

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
      await load();
      if (selectedId) setDetail(await fetchPortalCase(token, selectedId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được');
    } finally {
      setBusy(false);
    }
  }

  const filtering = Boolean(query || pageId || info);
  const ingestAlerts = inboxIngestAlerts(desk?.inbox, pages.length);

  return (
    <div className={selectedId ? 'tram-inbox is-open' : 'tram-inbox'}>
      <section className="tram-inbox__list">
        {ingestAlerts.length ? (
          <div
            role="alert"
            style={{
              margin: '0 0 0.75rem',
              padding: '0.65rem 0.85rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-md)',
              color: '#b91c1c',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {ingestAlerts.map((line) => (
              <p key={line} style={{ margin: ingestAlerts.length > 1 ? '0.25rem 0' : 0 }}>
                {line}
              </p>
            ))}
          </div>
        ) : null}
        <form
          className="tram-inbox__filters"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <div className="tram-inbox__filters-head">
            <h1>Hộp thư</h1>
            <span className="tram-inbox__count">
              {filtering ? `${threads.length} / ${desk?.messages.length ?? 0} hội thoại` : `${threads.length} hội thoại`}
            </span>
            {refreshedAt ? (
              <span className="tram-inbox__hint" style={{ display: 'block', marginTop: '0.35rem' }}>
                Cập nhật lúc {saigonRefreshLabel(refreshedAt)}
              </span>
            ) : null}
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, Page" aria-label="Tìm hội thoại" />
          <select value={pageId} onChange={(event) => setPageId(event.target.value)} aria-label="Lọc theo Page">
            <option value="">Tất cả Page — một hộp thư</option>
            {pages.map((page) => (
              <option key={page.page_id} value={page.page_id}>
                {page.page_name} · {page.page_id}
              </option>
            ))}
          </select>
          <select value={info} onChange={(event) => setInfo(event.target.value)} aria-label="Lọc theo số điện thoại hoặc địa chỉ">
            <option value="">Tất cả tin</option>
            <option value="phone">Đã có SĐT</option>
            <option value="address">Đã có địa chỉ</option>
            <option value="any">Đã có SĐT hoặc địa chỉ</option>
          </select>
          <div className="tram-inbox__filter-actions">
            {filtering ? (
              <button
                type="button"
                className="tram-inbox__clear"
                onClick={() => {
                  setQuery('');
                  setPageId('');
                  setInfo('');
                }}
              >
                Xóa lọc
              </button>
            ) : null}
          </div>
        </form>
        <div className="tram-inbox__rows">
          {threads.length === 0 ? (
            <div className="tram-inbox__empty">
              <p><strong>Chưa có tin nhắn.</strong></p>
              <p>
                {ingestAlerts.length
                  ? 'Xem banner phía trên: thường là thiếu quyền token hoặc Facebook từ chối đọc hội thoại.'
                  : 'Hội thoại chỉ hiện sau khi Page đã gắn có tin khách gửi vào.'}
              </p>
            </div>
          ) : (
            threads.map((row) => {
              const hit = scanContact(row.snippet || '');
              return (
                <button
                  key={row.id}
                  type="button"
                  className={row.id === selectedId ? 'tram-inbox__row is-active' : 'tram-inbox__row'}
                  onClick={() => setSelectedId(row.id)}
                >
                  <strong>{row.status === 'waiting_receive' ? '● ' : ''}{row.title || 'Khách'}</strong>
                  <p className="tram-inbox__status">{STATUS[row.status] || row.status}</p>
                  {hit.phone || hit.address ? (
                    <div className="tram-inbox__badges">
                      {hit.phone ? <span className="tram-inbox__badge tram-inbox__badge--phone">SĐT {hit.phone}</span> : null}
                      {hit.address ? <span className="tram-inbox__badge tram-inbox__badge--address">ĐC {hit.address}</span> : null}
                    </div>
                  ) : null}
                  <p className="tram-inbox__snippet">{row.snippet || 'Chưa có tin'}</p>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="tram-inbox__thread">
        {detail ? (
          <>
            <header className="tram-inbox__thread-head">
              <div className="tram-inbox__thread-head-main">
                <button type="button" className="tram-inbox__back" onClick={() => setSelectedId('')}>← Danh sách</button>
                <h2>{detail.case.title || 'Khách'}</h2>
                <p className="tram-inbox__assign">
                  <span>{STATUS[detail.case.status] || detail.case.status}</span>
                  <span> · {detail.case.assignee_email || 'Chưa phân công'}</span>
                </p>
                <div className="tram-inbox__detail">
                  {form.phone.trim() ? <p>SĐT {form.phone.trim()}</p> : null}
                  <div className="tram-inbox__chip-wrap">
                    <PageChip name={pageName.get(detail.case.page_id) || 'Page'} id={detail.case.page_id} />
                  </div>
                  {detail.case.labels.length > 0 ? (
                    <div className="tram-inbox__meta" aria-label="Nhãn">
                      {detail.case.labels.map((label) => (
                        <span key={label} className="tram-inbox__badge">{label}</span>
                      ))}
                    </div>
                  ) : null}
                  {detail.case.last_interaction_at ? (
                    <p className="tram-inbox__hint">Tương tác gần nhất: {when(detail.case.last_interaction_at)}</p>
                  ) : null}
                </div>
                {desk?.me.role !== 'staff' && (desk?.staff.length ?? 0) > 0 && detail.case.status !== 'purchased' ? (
                  <label className="tram-inbox__assign-pick">
                    <span>Gán cho</span>
                    <select
                      value={detail.case.assignee_user_id || ''}
                      disabled={busy}
                      aria-label="Gán cho nhân viên"
                      onChange={(event) => {
                        const user_id = event.target.value;
                        if (user_id) void run(() => postPortalCase(token, detail.case.id, 'assign', { user_id }));
                      }}
                    >
                      <option value="">Chọn nhân viên…</option>
                      {(desk?.staff ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.email}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {(desk?.me.role !== 'staff' || detail.case.assignee_user_id === desk?.me.id) && detail.case.status !== 'purchased' ? (
                  <div className="tram-inbox__assign-actions">
                    {detail.case.status === 'waiting_receive' ? (
                      <button type="button" className="tram-inbox__btn" disabled={busy} onClick={() => void run(() => postPortalCase(token, detail.case.id, 'receive'))}>Nhận</button>
                    ) : null}
                    {detail.case.status !== 'caring' ? (
                      <button type="button" className="tram-inbox__btn" disabled={busy} onClick={() => void run(() => postPortalCase(token, detail.case.id, 'care'))}>Xác nhận chăm sóc</button>
                    ) : (
                      <button type="button" className="tram-inbox__btn" disabled={busy} onClick={() => void run(() => postPortalCase(token, detail.case.id, 'purchase'))}>Mua hàng</button>
                    )}
                  </div>
                ) : null}
              </div>
            </header>
            <div className="tram-inbox__bubbles">
              {detail.messages.map((message) => {
                const customer = message.direction !== 'out';
                return (
                  <article key={message.id} className={customer ? 'tram-inbox__bubble' : 'tram-inbox__bubble is-out'}>
                    <header>
                      <span>{customer ? 'Khách' : 'Page'}</span>
                      <time>{when(message.received_at)}</time>
                    </header>
                    <p>{message.body || 'Không có chữ.'}</p>
                  </article>
                );
              })}
            </div>
            <form
              className="tram-inbox__reply"
              onSubmit={(event) => {
                event.preventDefault();
                const text = reply;
                void run(async () => {
                  await postPortalCase(token, detail.case.id, 'reply', { text });
                  setReply('');
                });
              }}
            >
              <label htmlFor="reply">Trả lời khách qua Page của hội thoại này</label>
              <div className="tram-inbox__reply-row">
                <textarea id="reply" value={reply} onChange={(event) => setReply(event.target.value)} rows={2} maxLength={2000} placeholder="Nhập tin gửi khách" />
                <button type="submit" className="tram-inbox__btn tram-inbox__btn--teal" disabled={busy || !reply.trim()}>
                  {busy ? 'Đang gửi' : 'Gửi'}
                </button>
              </div>
              <p className="tram-inbox__hint">Bấm Gửi thì tin đi tới Messenger của khách. Facebook chỉ nhận nếu khách còn nhắn trong 24 giờ gần nhất.</p>
              {error ? <p className="tram-inbox__error">{error}</p> : null}
            </form>
          </>
        ) : (
          <div className="tram-inbox__placeholder">
            <div>
              <h2>Chọn một hội thoại</h2>
              <p>Bấm một dòng bên trái. Nội dung tin hiện ở giữa, danh sách hội thoại giữ nguyên.</p>
              {error ? <p className="tram-inbox__error">{error}</p> : null}
            </div>
          </div>
        )}
      </section>
      <aside className="tram-inbox__side">
        {detail ? (
          <div className="tram-inbox__side-body">
            <div>
              <p className="tram-inbox__kicker">Page</p>
              <div className="tram-inbox__chip-wrap"><PageChip name={pageName.get(detail.case.page_id) || 'Page'} id={detail.case.page_id} /></div>
            </div>
            <div>
              <p className="tram-inbox__kicker">Khách</p>
              <p><strong>{detail.case.title || 'Khách'}</strong></p>
              <label className="tram-inbox__field">
                <span>Số điện thoại</span>
                <input
                  value={form.phone}
                  maxLength={40}
                  placeholder="Nhập hoặc sửa số"
                  onChange={(event) => setContact({ id: detail.case.id, phone: event.target.value, address: form.address })}
                />
              </label>
              <label className="tram-inbox__field">
                <span>Địa chỉ</span>
                <textarea
                  value={form.address}
                  rows={2}
                  maxLength={200}
                  placeholder="Nhập hoặc sửa địa chỉ"
                  onChange={(event) => setContact({ id: detail.case.id, phone: form.phone, address: event.target.value })}
                />
              </label>
              <button
                type="button"
                className="tram-inbox__btn tram-inbox__btn--teal"
                disabled={busy || !canClose}
                onClick={() => void run(() => postPortalCase(token, detail.case.id, 'close-order', { phone: form.phone, address: form.address }))}
              >
                Chốt đơn
              </button>
              {!canClose ? <p className="tram-inbox__hint">Chốt đơn khi đã có số điện thoại và địa chỉ.</p> : null}
              {detail.case.customer_id ? <p className="tram-inbox__hint">Đã thêm vào Khách hàng. Hội thoại vẫn nằm ở Tin nhắn.</p> : null}
            </div>
            <div>
              <p className="tram-inbox__kicker">Sản phẩm đã xác nhận</p>
              {order?.product_id ? (
                <ConfirmedProductRow order={order} products={products} />
              ) : (
                <p>Chưa xác nhận. Chọn size ở sản phẩm bên dưới.</p>
              )}
            </div>
            <div>
              <p className="tram-inbox__kicker">Sản phẩm Page đang bán</p>
              {desk?.me.role !== 'staff' ? (
                <p className="tram-inbox__hint">
                  <Link href={`/products?page_id=${encodeURIComponent(detail.case.page_id)}`}>Quản lý sản phẩm Page này</Link>
                </p>
              ) : null}
              {products.length === 0 ? (
                <p>Page này chưa có sản phẩm đang bán. Thêm ở mục Sản Phẩm.</p>
              ) : (
                <div className="portal-product-row-stack">
                  {products.map((item) => (
                    <ProductPick
                      key={`${detail.case.id}:${item.id}`}
                      item={item}
                      busy={busy}
                      canAct={canActProducts}
                      confirmed={order?.product_id === item.id ? order : null}
                      onConfirm={(size, color) => void run(() => postPortalCase(token, detail.case.id, 'order', {
                        product_id: item.id,
                        size,
                        color,
                        phone: form.phone,
                        address: form.address,
                      }))}
                      onSend={() => void run(() => postPortalCase(token, detail.case.id, 'send-product', { product_id: item.id }))}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="tram-inbox__empty">Chọn một tin để xem khách và sản phẩm của Page.</div>
        )}
      </aside>
    </div>
  );
}

function ConfirmedProductRow({
  order,
  products,
}: {
  order: PortalOrderDraft;
  products: PortalProductRecord[];
}) {
  const catalog = portalProductFromList(products, order.product_id);
  const imageUrl = resolvePortalProductImage(catalog, order.color);
  const variantLine = [order.color, order.size].filter(Boolean).join(' · ') || 'Không chọn size';

  return (
    <div className="portal-product-row-stack">
      <PortalProductRow
        name={order.product_name}
        imageUrl={imageUrl}
        priceVnd={order.price_vnd}
        variantLine={variantLine}
        confirmedHighlight
        footer={<span className="portal-product-row__badge">Đã xác nhận</span>}
      />
    </div>
  );
}

function ProductPick({
  item,
  busy,
  canAct,
  confirmed,
  onConfirm,
  onSend,
}: {
  item: PortalProductRecord;
  busy: boolean;
  canAct: boolean;
  confirmed: { size: string; color: string } | null;
  onConfirm: (size: string, color: string) => void;
  onSend: () => void;
}) {
  const sizes = item.spec?.sizes ?? [];
  const colors = item.spec?.colors ?? [];
  const [size, setSize] = useState(confirmed?.size || '');
  const [color, setColor] = useState(confirmed?.color || (colors.length === 1 ? colors[0].name : ''));
  const resolvedColor = colors.length === 1 ? colors[0].name : color;
  const ready = (sizes.length === 0 || Boolean(size)) && (colors.length <= 1 || Boolean(color));
  const selectionMatches =
    confirmed &&
    confirmed.size === size &&
    confirmed.color === resolvedColor;
  const variantLine = [resolvedColor, size].filter(Boolean).join(' · ') || undefined;
  const imageUrl = resolvePortalProductImage(item, resolvedColor);

  return (
    <PortalProductRow
      name={item.name}
      imageUrl={imageUrl}
      priceVnd={item.spec?.price_vnd}
      variantLine={variantLine}
      confirmedHighlight={Boolean(selectionMatches)}
      footer={
        <>
          {colors.length > 1 ? (
            <div className="tram-inbox__sizes">
              {colors.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  className={color === entry.name ? 'tram-inbox__size is-on' : 'tram-inbox__size'}
                  onClick={() => setColor(entry.name)}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          ) : null}
          {sizes.length ? (
            <div className="tram-inbox__sizes">
              {sizes.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className={size === entry ? 'tram-inbox__size is-on' : 'tram-inbox__size'}
                  onClick={() => setSize(entry)}
                >
                  {entry}
                </button>
              ))}
            </div>
          ) : null}
          <div className="tram-inbox__product-actions">
            <button
              type="button"
              className="tram-inbox__btn"
              disabled={busy || !ready || !canAct}
              onClick={() => onConfirm(size, resolvedColor)}
            >
              {selectionMatches ? 'Đã xác nhận' : 'Xác nhận sản phẩm'}
            </button>
            <button
              type="button"
              className="tram-inbox__btn tram-inbox__btn--teal"
              disabled={busy || !canAct}
              onClick={onSend}
            >
              Gửi cho khách
            </button>
          </div>
        </>
      }
    />
  );
}

function PageChip({ name, id }: { name: string; id: string }) {
  return (
    <span className="tram-inbox__pagechip">
      <span>Page</span>
      <strong>{name}</strong>
      <em>ID {id}</em>
    </span>
  );
}
