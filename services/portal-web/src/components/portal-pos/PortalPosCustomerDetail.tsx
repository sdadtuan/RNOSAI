'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { setPortalTitleOverride } from '@/lib/portal/nav';
import { avatarTone, displayVnPhone, initials } from '@/components/portal-crm/portal-inbox.util';
import { POS_STATUS_LABEL, posGet, posPost, vnd, type PosOrder, type PosRisk } from '@/lib/portal-pos-api';

type SourceKey = 'lead' | 'message' | 'order';
type ProfileTab = 'orders' | 'activity' | 'notes';

type ProfileOrderItem = { name: string; color: string; size: string; qty: number; price_vnd: number };

type ProfileOrder = {
  id: string;
  code: string;
  status: string;
  total_vnd: number;
  cod_vnd: number;
  created_at: string;
  assignee_email?: string;
  ship_status?: string;
  tracking_code?: string;
  items?: ProfileOrderItem[];
};

type NoteRow = { id: string; body: string; author_email: string; created_at: string };

type Profile = {
  phone: string;
  customer: {
    name?: string;
    email?: string;
    address?: string;
    notes?: string;
    blacklist?: boolean;
    created_at?: string;
    sources?: SourceKey[];
  } | null;
  risk: PosRisk;
  kpis?: {
    order_count: number;
    spend_vnd: number;
    avg_order_vnd: number;
    return_rate: number;
    first_purchase_at: string;
    last_purchase_at: string;
  };
  labels?: string[];
  assignee_email?: string;
  email?: string;
  address?: string;
  created_at?: string;
  page_id?: string;
  page_name?: string;
  sources?: SourceKey[];
  notes?: NoteRow[];
  orders: ProfileOrder[];
  conversations: Array<{ id: string; title: string; page_id: string; status: string; kind: string }>;
  leads: Array<{ id: string; full_name: string; phone: string; email?: string; campaign_name: string }>;
  timeline?: Array<{ kind: string; at: string; title: string; meta?: string }>;
};

const SOURCE_LABEL: Record<string, string> = { lead: 'Lead', message: 'Tin nhắn', order: 'Đơn' };

const SHIP_VI: Record<string, string> = {
  created: 'Đã tạo vận đơn',
  pending: 'Chờ xử lý',
  picking: 'Đang lấy hàng',
  transporting: 'Đang vận chuyển',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy vận đơn',
  returned: 'Hoàn hàng',
  failed: 'Giao thất bại',
};

const KIND_VI: Record<string, { label: string; tone: string }> = {
  order: { label: 'Đơn hàng', tone: '#1d4ed8' },
  message: { label: 'Tin nhắn', tone: '#0f766e' },
  inbox: { label: 'Tin nhắn', tone: '#0f766e' },
  lead: { label: 'Lead', tone: '#b45309' },
  status: { label: 'Trạng thái', tone: '#7c3aed' },
  note: { label: 'Ghi chú', tone: '#374151' },
};

function when(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function day(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN');
}

function staffLabel(email?: string): string {
  const local = email?.split('@')[0]?.trim();
  return local || 'Chưa gán';
}

function sourcesOf(profile: Profile): SourceKey[] {
  if (profile.sources?.length) return profile.sources;
  const set = new Set<SourceKey>();
  if (profile.orders?.length) set.add('order');
  if (profile.leads?.length) set.add('lead');
  if (profile.conversations?.some((row) => row.kind === 'message' || row.kind === 'inbox' || row.kind === '')) set.add('message');
  return [...set];
}

function tagClass(label: string): string {
  if (label === 'VIP') return 'pos-badge pos-tag--vip';
  if (label === 'Mới') return 'pos-badge pos-tag--new';
  if (label === 'Quay lại') return 'pos-badge pos-tag--back';
  if (label === 'Rủi ro hoàn') return 'pos-badge pos-tag--risk';
  return 'pos-badge pos-badge--off';
}

function profileTags(profile: Profile): string[] {
  const count = profile.kpis?.order_count ?? profile.orders.length;
  const spend = profile.kpis?.spend_vnd ?? 0;
  const rate = profile.kpis?.return_rate ?? 0;
  const tags: string[] = [];
  if (spend >= 5_000_000 || count >= 5) tags.push('VIP');
  if (count >= 2) tags.push('Quay lại');
  else tags.push('Mới');
  if (rate > 0.2 || profile.risk?.level === 'warn' || profile.risk?.level === 'block') tags.push('Rủi ro hoàn');
  for (const label of profile.labels ?? []) {
    if (label && !tags.includes(label)) tags.push(label);
  }
  return tags;
}

function legacyNotes(profile: Profile): NoteRow[] {
  if (profile.notes?.length) return profile.notes;
  const blob = profile.customer?.notes?.trim();
  if (!blob) return [];
  return blob.split('\n').filter(Boolean).map((body, index) => ({
    id: `legacy-${index}`,
    body,
    author_email: '',
    created_at: '',
  }));
}

function productSummary(items: ProfileOrderItem[] | undefined): { line: string; extra: number } {
  if (!items?.length) return { line: '—', extra: 0 };
  const first = items[0];
  const variant = [first.color, first.size].filter(Boolean).join(' / ');
  const line = `${first.name}${variant ? ` · ${variant}` : ''} × ${first.qty}`;
  return { line, extra: items.length - 1 };
}

export function PortalPosCustomerDetail({
  token,
  phone,
  canManage,
  readOnly,
}: {
  token: string;
  phone: string;
  canManage: boolean;
  readOnly: boolean;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<ProfileTab>('orders');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menu, setMenu] = useState(false);
  const [order, setOrder] = useState<PosOrder | null>(null);
  const [orderBusy, setOrderBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await posGet<Profile>(token, `/api/portal/pos/customers/${encodeURIComponent(phone)}`);
    setProfile(res);
  }, [token, phone]);

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được hồ sơ'));
  }, [load]);

  const name = profile?.customer?.name || 'Khách';
  useEffect(() => {
    setPortalTitleOverride(profile ? `${name} · Khách hàng` : 'Hồ sơ khách');
    return () => setPortalTitleOverride(null);
  }, [profile, name]);

  const notes = profile ? legacyNotes(profile) : [];
  const sources = profile ? sourcesOf(profile) : [];
  const email = profile?.email || profile?.customer?.email || profile?.leads.find((row) => row.email)?.email || '';
  const address = profile?.address || profile?.customer?.address || '';
  const since = profile?.created_at || profile?.customer?.created_at || profile?.kpis?.first_purchase_at || '';
  const pageLabel = profile?.page_name || profile?.conversations[0]?.page_id || profile?.page_id || '';
  const talk = profile?.conversations[0];
  const createHref = `/crm/orders/new?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name === 'Khách' ? '' : name)}`;
  const messageHref = talk ? `/crm/messages?open=${encodeURIComponent(talk.id)}` : '/crm/messages';
  const kpis = profile?.kpis;
  const tags = profile ? profileTags(profile) : [];

  const activity = useMemo(() => {
    const rows = [...(profile?.timeline ?? [])];
    for (const row of notes) {
      if (!row.body) continue;
      if (rows.some((item) => item.kind === 'note' && item.meta === row.body)) continue;
      rows.push({ kind: 'note', at: row.created_at, title: 'Ghi chú', meta: row.body });
    }
    rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return rows;
  }, [profile?.timeline, notes]);

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(displayVnPhone(phone) || phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Không sao chép được số điện thoại');
    }
  }

  async function saveNote() {
    const text = note.trim();
    if (!text || !profile || readOnly) return;
    setNoteBusy(true);
    setError('');
    try {
      try {
        const res = await posPost<Profile>(token, `/api/portal/pos/customers/${encodeURIComponent(phone)}/notes`, { body: text });
        setProfile(res);
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        const missing = /404|cannot post|not found/i.test(message);
        if (!missing || !canManage) throw err;
        const prev = profile.customer?.notes?.trim() ?? '';
        const line = `${new Date().toLocaleString('vi-VN')} — ${text}`;
        const res = await posPost<Profile>(token, `/api/portal/pos/customers/${encodeURIComponent(phone)}/blacklist`, {
          blacklist: profile.customer?.blacklist === true,
          notes: prev ? `${prev}\n${line}` : line,
        });
        setProfile(res);
      }
      setNote('');
      setTab('notes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được ghi chú');
    } finally {
      setNoteBusy(false);
    }
  }

  async function toggleLimit() {
    if (!profile || !canManage) return;
    setMenu(false);
    const res = await posPost<Profile>(token, `/api/portal/pos/customers/${encodeURIComponent(phone)}/blacklist`, {
      blacklist: !profile.customer?.blacklist,
    });
    setProfile(res);
  }

  async function openOrder(id: string) {
    setOrderBusy(true);
    setError('');
    try {
      const res = await posGet<{ order: PosOrder }>(token, `/api/portal/pos/orders/${id}`);
      setOrder(res.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không mở được đơn');
    } finally {
      setOrderBusy(false);
    }
  }

  if (!profile) {
    return <div className="pos"><p className="pos-hint">{error || 'Đang tải hồ sơ…'}</p></div>;
  }

  return (
    <div className="pos pos-profile">
      <Link className="pos-back" href="/crm/customers">← Khách hàng</Link>
      {error ? <p className="pos-error">{error}</p> : null}
      <header className="pos-profile__hero">
        <span className="pos-profile__avatar" style={{ background: avatarTone(name) }} aria-hidden>{initials(name)}</span>
        <div className="pos-profile__id">
          <h1>{name}</h1>
          <p className="pos-profile__phone">
            <span className="pos-tabular">{displayVnPhone(profile.phone) || profile.phone}</span>
            <button type="button" className="pos-btn pos-btn--sm pos-btn--ghost" onClick={() => void copyPhone()}>{copied ? 'Đã chép' : 'Sao chép'}</button>
            <a className="pos-btn pos-btn--sm pos-btn--ghost" href={`tel:${displayVnPhone(profile.phone) || profile.phone}`}>Gọi</a>
          </p>
          <p className="pos-hint">
            {email || 'Chưa có email'}
            {' · '}
            {sources.length ? sources.map((item) => SOURCE_LABEL[item] || item).join(', ') : 'Chưa rõ nguồn'}
            {' · '}
            {staffLabel(profile.assignee_email)}
            {since ? ` · Khách từ ${day(since)}` : ''}
          </p>
          <div className="pos-customer-profile__tags">
            {tags.map((label) => <span key={label} className={tagClass(label)}>{label}</span>)}
          </div>
        </div>
        <div className="pos__actions">
          <Link className="pos-btn pos-btn--teal" href={createHref}>+ Tạo đơn</Link>
          <Link className="pos-btn" href={messageHref}>Nhắn tin</Link>
          <a className="pos-btn" href={`tel:${displayVnPhone(profile.phone) || profile.phone}`}>Gọi</a>
          {canManage ? (
            <div className="pos-menu">
              <button type="button" className="pos-btn pos-btn--sm pos-btn--ghost" aria-label="Thêm thao tác" aria-expanded={menu} onClick={() => setMenu((open) => !open)}>…</button>
              {menu ? (
                <div className="pos-menu__pop">
                  <button type="button" className="pos-menu__item" onClick={() => void toggleLimit()}>
                    {profile.customer?.blacklist ? 'Bỏ hạn chế' : 'Đưa vào danh sách hạn chế'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div className="pos-profile-kpis">
        <div className="pos-profile-kpi"><span>Số đơn</span><strong>{kpis?.order_count ?? 0}</strong></div>
        <div className="pos-profile-kpi"><span>Tổng chi tiêu</span><strong>{vnd(kpis?.spend_vnd)}</strong></div>
        <div className="pos-profile-kpi"><span>Giá trị TB</span><strong>{vnd(kpis?.avg_order_vnd)}</strong></div>
        <div className={`pos-profile-kpi${(kpis?.return_rate ?? 0) > 0.2 ? ' is-danger' : ''}`}><span>Tỷ lệ hoàn</span><strong>{((kpis?.return_rate ?? 0) * 100).toFixed(0)}%</strong></div>
        <div className="pos-profile-kpi"><span>Lần mua đầu</span><strong>{day(kpis?.first_purchase_at ?? '')}</strong></div>
        <div className="pos-profile-kpi"><span>Lần mua gần nhất</span><strong>{day(kpis?.last_purchase_at ?? '')}</strong></div>
      </div>

      <div className="pos-profile-layout">
        <section className="pos-card pos-profile-main">
          <div className="pos-profile-tabs" role="tablist">
            <button type="button" role="tab" className={tab === 'orders' ? 'pos-profile-tabs__btn is-on' : 'pos-profile-tabs__btn'} onClick={() => setTab('orders')}>Đơn hàng</button>
            <button type="button" role="tab" className={tab === 'activity' ? 'pos-profile-tabs__btn is-on' : 'pos-profile-tabs__btn'} onClick={() => setTab('activity')}>Hoạt động</button>
            <button type="button" role="tab" className={tab === 'notes' ? 'pos-profile-tabs__btn is-on' : 'pos-profile-tabs__btn'} onClick={() => setTab('notes')}>Ghi chú</button>
          </div>

          {tab === 'orders' ? (
            profile.orders.length ? (
              <div className="pos-profile-table-wrap">
                <table className="pos-table pos-table--orders">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Ngày</th>
                      <th>Sản phẩm</th>
                      <th className="pos-col-num">Tổng</th>
                      <th className="pos-col-num">COD</th>
                      <th>Trạng thái</th>
                      <th>Vận chuyển</th>
                      <th>Nhân viên</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.orders.map((row) => {
                      const summary = productSummary(row.items);
                      const ship = row.tracking_code || (row.ship_status ? (SHIP_VI[row.ship_status] || row.ship_status) : '');
                      return (
                        <tr key={row.id} onClick={() => void openOrder(row.id)}>
                          <td><Link href={`/crm/orders/${row.id}`} onClick={(event) => event.stopPropagation()}>{row.code}</Link></td>
                          <td>{when(row.created_at)}</td>
                          <td>
                            <span className="pos-order-products">{summary.line}</span>
                            {summary.extra > 0 ? <span className="pos-hint"> +{summary.extra} sản phẩm</span> : null}
                          </td>
                          <td className="pos-col-num pos-tabular">{vnd(row.total_vnd)}</td>
                          <td className="pos-col-num pos-tabular">{vnd(row.cod_vnd)}</td>
                          <td><span className={`pos-badge pos-badge--${row.status}`}>{POS_STATUS_LABEL[row.status] || row.status}</span></td>
                          <td>{ship ? <span className="pos-badge pos-badge--off">{ship}</span> : '—'}</td>
                          <td>{staffLabel(row.assignee_email)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="pos-empty">Chưa có đơn. <Link href={createHref}>Tạo đơn đầu tiên</Link></p>
            )
          ) : null}

          {tab === 'activity' ? (
            activity.length ? (
              <ol className="pos-activity">
                {activity.map((row, index) => {
                  const kind = KIND_VI[row.kind] || { label: 'Hoạt động', tone: '#6b7280' };
                  return (
                    <li key={`${row.kind}-${row.at}-${index}`}>
                      <span className="pos-activity__dot" style={{ background: kind.tone }} aria-hidden />
                      <div>
                        <p className="pos-activity__title"><span className="pos-badge pos-badge--off">{kind.label}</span> {row.title}</p>
                        <p className="pos-hint">{when(row.at)}{row.meta ? ` · ${row.meta}` : ''}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="pos-empty">Chưa có hoạt động.</p>
          ) : null}

          {tab === 'notes' ? (
            <div className="pos-notes">
              {readOnly ? <p className="pos-hint">Tài khoản Chỉ xem không thêm ghi chú.</p> : (
                <form onSubmit={(event) => { event.preventDefault(); void saveNote(); }}>
                  <label className="pos-field">
                    Ghi chú nội bộ
                    <textarea className="pos-input" rows={3} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú chỉ nhân viên thấy" />
                  </label>
                  <button type="submit" className="pos-btn pos-btn--teal pos-btn--sm" disabled={noteBusy || !note.trim()} style={{ marginTop: 8 }}>
                    {noteBusy ? 'Đang lưu…' : 'Lưu ghi chú'}
                  </button>
                </form>
              )}
              <ul className="pos-notes__list">
                {notes.map((row) => (
                  <li key={row.id}>
                    <p>{row.body}</p>
                    <p className="pos-hint">{[staffLabel(row.author_email) === 'Chưa gán' ? '' : staffLabel(row.author_email), when(row.created_at)].filter((part) => part && part !== '—').join(' · ')}</p>
                  </li>
                ))}
                {!notes.length ? <li className="pos-hint">Chưa có ghi chú.</li> : null}
              </ul>
            </div>
          ) : null}
        </section>

        <aside>
          <section className="pos-side-card">
            <h3>Thông tin liên hệ</h3>
            <dl className="pos-profile-info">
              <div><dt>Tên</dt><dd>{name}</dd></div>
              <div><dt>Số điện thoại</dt><dd className="pos-tabular">{displayVnPhone(profile.phone) || profile.phone}</dd></div>
              <div><dt>Địa chỉ</dt><dd>{address || '—'}</dd></div>
              <div><dt>Nguồn</dt><dd>{sources.length ? sources.map((item) => SOURCE_LABEL[item] || item).join(', ') : '—'}</dd></div>
              <div><dt>Page</dt><dd>{pageLabel || '—'}</dd></div>
            </dl>
          </section>
          <section className="pos-side-card">
            <h3>Lead liên quan</h3>
            {profile.leads.length ? (
              <ul className="pos-side-list">
                {profile.leads.map((lead) => (
                  <li key={lead.id}>
                    <Link href={`/crm/leads`}>{lead.full_name || lead.phone || 'Lead'}</Link>
                    {lead.campaign_name ? <span className="pos-hint"> · {lead.campaign_name}</span> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="pos-hint">Chưa có lead gắn số này.</p>}
          </section>
          <section className="pos-side-card">
            <h3>Thông tin khác</h3>
            <dl className="pos-profile-info">
              <div><dt>Email</dt><dd>{email || '—'}</dd></div>
              <div><dt>Nhân viên phụ trách</dt><dd>{staffLabel(profile.assignee_email)}</dd></div>
              <div><dt>Hội thoại</dt><dd>{profile.conversations.length ? profile.conversations.length : '—'}</dd></div>
              <div><dt>Hạn chế</dt><dd>{profile.customer?.blacklist ? 'Đang hạn chế' : 'Không'}</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      {order || orderBusy ? (
        <div className="pos-drawer" onClick={() => setOrder(null)}>
          <div className="pos-drawer__panel pos-drawer__panel--order" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Chi tiết đơn">
            <button type="button" className="pos-btn pos-btn--sm pos-btn--ghost" onClick={() => setOrder(null)}>Đóng</button>
            {!order ? <p className="pos-hint">Đang tải đơn…</p> : (
              <>
                <h2>
                  {order.code}{' '}
                  <span className={`pos-badge pos-badge--${order.status}`}>{POS_STATUS_LABEL[order.status] || order.status}</span>
                </h2>
                <p className="pos-hint">{when(order.created_at)} · {staffLabel(order.assignee_email)}</p>
                <p>{[order.address, order.ward, order.district, order.province].filter(Boolean).join(', ') || 'Chưa có địa chỉ giao'}</p>
                <ul className="pos-side-list">
                  {order.items.map((item, index) => (
                    <li key={item.id || index}>
                      <strong>{item.name}</strong>
                      <span className="pos-hint"> {[item.color, item.size].filter(Boolean).join(' / ')} × {item.qty} · {vnd(item.price_vnd * item.qty)}</span>
                    </li>
                  ))}
                </ul>
                <p className="pos-line pos-line--total"><span>Tổng / COD</span><span className="pos-tabular">{vnd(order.total_vnd)} / {vnd(order.cod_vnd)}</span></p>
                <h3>Lịch sử trạng thái</h3>
                {order.events?.length ? (
                  <ol className="pos-activity">
                    {order.events.map((event) => (
                      <li key={event.id}>
                        <span className="pos-activity__dot" style={{ background: '#1d4ed8' }} aria-hidden />
                        <div>
                          <p className="pos-activity__title">{POS_STATUS_LABEL[event.to_status] || event.to_status}</p>
                          <p className="pos-hint">
                            {event.from_status ? `${POS_STATUS_LABEL[event.from_status] || event.from_status} → ` : ''}
                            {when(event.created_at)}
                            {event.note ? ` · ${event.note}` : ''}
                            {event.actor_email ? ` · ${staffLabel(event.actor_email)}` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : <p className="pos-hint">Chưa có lịch sử trạng thái.</p>}
                <p style={{ marginTop: 12 }}><Link href={`/crm/orders/${order.id}`}>Mở trang đơn</Link></p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
