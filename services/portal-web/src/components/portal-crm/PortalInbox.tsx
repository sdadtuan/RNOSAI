'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PortalPageShell } from '@/components/PortalPageShell';
import {
  deletePortalQuickReply,
  fetchPortalCase,
  fetchPortalDesk,
  fetchPortalLive,
  postPortalCase,
  postPortalCaseCreateLead,
  postPortalCaseNotes,
  postPortalCaseRead,
  postPortalQuickReply,
  type PortalCaseDetail,
  type PortalCareCase,
  type PortalDesk,
  type PortalLinkedLead,
  type PortalOrderDraft,
  type PortalProductRecord,
  type PortalQuickReply,
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
import {
  absoluteTime,
  avatarTone,
  displayVnPhone,
  extractContacts,
  initials,
  relativeTime,
  scanContact,
  displayPageName,
  slashQuery,
  splitMedia,
} from '@/components/portal-crm/portal-inbox.util';
import { PortalInboxComments, InboxSkeleton } from '@/components/portal-crm/PortalInboxComments';
import { PortalInboxQuickReplies } from '@/components/portal-crm/PortalInboxQuickReplies';
import { PortalInboxReportStrip } from '@/components/portal-crm/PortalInboxReport';
import { PortalInboxSettings } from '@/components/portal-crm/PortalInboxSettings';
import { PortalPosOrderForm } from '@/components/portal-pos/PortalPosOrderForm';
import { PortalInboxListHeader } from '@/components/portal-crm/PortalInboxListHeader';
import { PortalInboxSideTabs, type InboxSideTab } from '@/components/portal-crm/PortalInboxSideTabs';

const STATUS: Record<string, string> = {
  waiting_receive: 'Chờ nhận',
  received: 'Đã nhận',
  caring: 'Đang chăm sóc',
  purchased: 'Mua hàng',
};

const TAG_PALETTE = ['#1877f2', '#0f766e', '#b45309', '#be123c', '#7c3aed', '#0369a1', '#365314'];

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

function isUnread(row: PortalCareCase): boolean {
  if (typeof row.unread === 'boolean') return row.unread;
  return row.status === 'waiting_receive';
}

function isUnreplied(row: PortalCareCase): boolean {
  if (typeof row.unreplied === 'boolean') return row.unreplied;
  return false;
}

function threadContacts(row: PortalCareCase, extra = ''): { phones: string[]; emails: string[] } {
  return extractContacts(`${row.snippet || ''}\n${row.phone || ''}\n${row.order?.phone || ''}\n${row.notes || ''}\n${extra}`);
}

function collisionNote(row: PortalCareCase, meId?: string, now = new Date()): string {
  const other = row.last_viewed_by;
  if (!other || (meId && other === meId)) return '';
  const at = row.last_viewed_at ? new Date(row.last_viewed_at) : null;
  if (!at || Number.isNaN(at.getTime())) return '';
  if (now.getTime() - at.getTime() > 10 * 60 * 1000) return '';
  const who = row.last_viewed_email || 'Nhân viên khác';
  return `${who} vừa xem hội thoại này ${relativeTime(row.last_viewed_at || '', now)}.`;
}

function messageImages(
  body: string,
  attachments?: Array<{ type: string; url: string; mime_type: string; name: string }>,
): string[] {
  const media = splitMedia(body);
  const extra: string[] = [];
  for (const item of attachments ?? []) {
    const url = String(item.url ?? '').trim();
    if (!url) continue;
    const image =
      item.type === 'image' ||
      /^image\//i.test(item.mime_type || '') ||
      /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
    if (image) extra.push(url);
  }
  return [...new Set([...media.images, ...extra])];
}



export function PortalInbox() {
  const [crumb, setCrumb] = useState('Tin nhắn');
  return (
    <PortalPageShell breadcrumb={[{ label: 'Cổng khách hàng', href: '/crm' }, { label: crumb }]}>
      {({ token }) => (
        <InboxBody token={token} onMainTab={(tab) => setCrumb(tab === 'comments' ? 'Bình luận' : 'Tin nhắn')} />
      )}
    </PortalPageShell>
  );
}

function InboxBody({ token, onMainTab }: { token: string; onMainTab?: (tab: 'messages' | 'comments') => void }) {
  const [desk, setDesk] = useState<PortalDesk | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<PortalCaseDetail | null>(null);
  const [query, setQuery] = useState('');
  const [pageId, setPageId] = useState('');
  const [tag, setTag] = useState('');
  const [staffId, setStaffId] = useState('');
  const [quick, setQuick] = useState<'all' | 'unread' | 'unreplied' | 'phone' | 'mine' | 'unassigned'>('all');
  const [info, setInfo] = useState('');
  const [contact, setContact] = useState({ id: '', phone: '', address: '' });
  const [reply, setReply] = useState('');
  const [notes, setNotes] = useState('');
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', email: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  const [newTag, setNewTag] = useState('');
  const [templateForm, setTemplateForm] = useState({ shortcut: '', title: '', body: '' });
  const [showTemplates, setShowTemplates] = useState(false);
  const [didSelect, setDidSelect] = useState(false);
  const [mainTab, setMainTab] = useState<'messages' | 'comments'>('messages');
  useEffect(() => {
    onMainTab?.(mainTab);
  }, [mainTab, onMainTab]);
  const [sideOpen, setSideOpen] = useState(false);
  const [sideTab, setSideTab] = useState<InboxSideTab>('chot');
  const bubblesRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (sync = false) => {
    const data = await fetchPortalDesk(token, sync ? { sync: '1' } : {});
    setDesk((current) => (current ? mergeDeskMessages(current, data) : data));
    setRefreshedAt(new Date());
  }, [token]);

  useEffect(() => {
    void load(true).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được hộp thư'));
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
            const extra = fresh.filter(
              (row) =>
                row.page_id === current.case.page_id &&
                row.sender_name.toLowerCase() === title &&
                !current.messages.some((item) => item.id === row.id),
            );
            if (!extra.length) return current;
            return { ...current, messages: [...current.messages, ...extra] };
          });
        }
        schedule(fresh.length >= 40 && burst < 3 ? ((burst += 1), 400) : ((burst = 0), 5000));
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
        // Local desk only — Graph sync is on demand when the page first opens, or via "Làm mới".
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
    let cancelled = false;
    void fetchPortalCase(token, selectedId)
      .then((next) => {
        if (cancelled) return;
        setDetail(next);
        setNotes(next.case.notes ?? '');
        void postPortalCaseRead(token, selectedId)
          .then(() => {
            if (cancelled) return;
            setDesk((current) => {
              if (!current) return current;
              return {
                ...current,
                messages: current.messages.map((row) =>
                  row.id === selectedId ? { ...row, unread: false, last_read_at: new Date().toISOString() } : row,
                ),
              };
            });
          })
          .catch(() => undefined);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không mở được hội thoại'));
    return () => {
      cancelled = true;
    };
  }, [token, selectedId]);

  useEffect(() => {
    const el = bubblesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [detail?.messages.length, selectedId]);

  const pages = (desk?.pages ?? []).filter((page) => page.channel !== 'ad_account');
  const pageName = new Map(pages.map((page) => [page.page_id, page.page_name || page.page_id]));
  const labelColor = new Map((desk?.labels ?? []).map((item) => [item.name, item.color]));
  const templates = desk?.quick_replies ?? [];

  const threads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (desk?.messages ?? []).filter((row) => {
      if (pageId && row.page_id !== pageId) return false;
      if (tag && !row.labels.includes(tag)) return false;
      if (staffId && row.assignee_user_id !== staffId) return false;
      const contacts = threadContacts(row);
      if (quick === 'unread' && !isUnread(row)) return false;
      if (quick === 'unreplied' && !isUnreplied(row)) return false;
      if (quick === 'phone' && !contacts.phones.length) return false;
      if (quick === 'mine' && row.assignee_user_id !== desk?.me.id) return false;
      if (quick === 'unassigned' && row.assignee_user_id) return false;
      if (info === 'phone' && !contacts.phones.length) return false;
      if (info === 'address' && !scanContact(row.snippet || '').address) return false;
      if (info === 'any' && !contacts.phones.length && !scanContact(row.snippet || '').address) return false;
      if (!needle) return true;
      const blob = `${row.title} ${row.page_id} ${pageName.get(row.page_id) || ''} ${row.assignee_email || ''} ${row.snippet || ''} ${row.labels.join(' ')} ${contacts.phones.join(' ')}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [desk, query, pageId, tag, staffId, quick, info, pageName]);

  useEffect(() => {
    if (didSelect) return;
    if (threads.length) {
      setSelectedId(threads[0].id);
      setDidSelect(true);
    }
  }, [threads, didSelect]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (mainTab !== 'messages') return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      if (!threads.length) return;
      const idx = Math.max(0, threads.findIndex((row) => row.id === selectedId));
      const next = event.key === 'ArrowDown' ? Math.min(threads.length - 1, idx + 1) : Math.max(0, idx - 1);
      const row = threads[next];
      if (row) setSelectedId(row.id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [threads, selectedId, mainTab]);

  const unreadCount = (desk?.messages ?? []).filter(isUnread).length;
  const unrepliedCount = (desk?.messages ?? []).filter(isUnreplied).length;
  const phoneCount = (desk?.messages ?? []).filter((row) => threadContacts(row).phones.length).length;
  const mineCount = (desk?.messages ?? []).filter((row) => row.assignee_user_id && row.assignee_user_id === desk?.me.id).length;
  const unassignedCount = (desk?.messages ?? []).filter((row) => !row.assignee_user_id).length;

  const products = (desk?.products ?? []).filter(
    (item) => detail && item.page_id === detail.case.page_id && item.active !== false,
  );
  const canActProducts =
    Boolean(detail) &&
    (desk?.me.role !== 'staff' || detail?.case.assignee_user_id === desk?.me.id) &&
    detail?.case.status !== 'purchased';
  const threadText = (detail?.messages ?? []).filter((msg) => msg.direction !== 'out').map((msg) => msg.body).join('\n');
  const scanned = extractContacts(`${detail?.case.snippet || ''}\n${threadText}\n${detail?.case.notes || ''}`);
  const detectedPhones = [...new Set([...(detail?.detected?.phones ?? []), ...scanned.phones].map(displayVnPhone))];
  const detectedEmails = [...new Set([...(detail?.detected?.emails ?? []), ...scanned.emails])];
  const form =
    detail && contact.id === detail.case.id
      ? contact
      : {
          id: detail?.case.id ?? '',
          phone: detail?.case.order?.phone || detectedPhones[0] || '',
          address: detail?.case.order?.address || scanContact(threadText).address || '',
        };
  const order = detail?.case.order;
  const canClose = Boolean(form.phone.trim() && form.address.trim());
  const linkedLeads: PortalLinkedLead[] = detail?.linked_leads ?? [];
  const psid = detail?.psid || '';

  useEffect(() => {
    if (!detail) return;
    setLeadForm({
      name: detail.case.title || '',
      phone: displayVnPhone(detail.case.order?.phone || detectedPhones[0] || ''),
      email: detectedEmails[0] || '',
    });
    setNotes(detail.case.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefills when the conversation changes
  }, [detail?.case.id]);

  const slash = slashQuery(reply, replyRef.current?.selectionStart);
  const slashHits = useMemo(() => {
    if (!slash || !slashOpen && slash.query === undefined) return [];
    const q = (slash?.query ?? '').toLowerCase();
    return templates.filter(
      (item) =>
        !q ||
        item.shortcut.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q),
    );
  }, [slash, slashOpen, templates]);

  useEffect(() => {
    setSlashOpen(Boolean(slash));
    setSlashIdx(0);
  }, [slash?.start, slash?.query]);

  function applyTemplate(item: PortalQuickReply) {
    const match = slashQuery(reply, replyRef.current?.selectionStart);
    if (!match) {
      setReply((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${item.body}`);
    } else {
      setReply(reply.slice(0, match.start) + item.body + reply.slice(match.start + 1 + match.query.length));
    }
    setSlashOpen(false);
    replyRef.current?.focus();
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
      await load(false);
      if (selectedId) {
        const next = await fetchPortalCase(token, selectedId);
        setDetail(next);
        setNotes(next.case.notes ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được');
    } finally {
      setBusy(false);
    }
  }

  const filtering = Boolean(query || pageId || tag || staffId || quick !== 'all' || info);
  const ingestAlerts = inboxIngestAlerts(desk?.inbox, pages.length);

  const inboxTabs = (
    <div className="tram-inbox__tabs" role="tablist" aria-label="Loại hội thoại">
      <button
        type="button"
        role="tab"
        aria-selected={mainTab === 'messages'}
        className={mainTab === 'messages' ? 'tram-inbox__tab is-on' : 'tram-inbox__tab'}
        onClick={() => setMainTab('messages')}
      >
        Tin nhắn
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mainTab === 'comments'}
        className={mainTab === 'comments' ? 'tram-inbox__tab is-on' : 'tram-inbox__tab'}
        onClick={() => setMainTab('comments')}
      >
        Bình luận
      </button>
    </div>
  );

  if (mainTab === 'comments') {
    return (
      <PortalInboxComments
        token={token}
        tabs={inboxTabs}
        headerActions={
          <>
            <PortalInboxReportStrip token={token} />
            <PortalInboxSettings token={token} canEdit={desk?.me.role !== 'staff'} />
          </>
        }
      />
    );
  }

  const collide = detail?.case ? collisionNote(detail.case, desk?.me.id) : '';

  return (
    <div className={`${selectedId ? 'tram-inbox is-open is-pancake' : 'tram-inbox is-pancake'}${sideOpen ? ' is-side-open' : ''}`}>
      <section className="tram-inbox__list">
        <PortalInboxListHeader
          tabs={inboxTabs}
          title="Hộp thư"
          countLabel={
            filtering
              ? `${threads.length} / ${desk?.messages.length ?? 0} hội thoại`
              : `${threads.length} hội thoại`
          }
          headerActions={
            <>
              <PortalInboxReportStrip token={token} />
              <PortalInboxSettings token={token} canEdit={desk?.me.role !== 'staff'} />
            </>
          }
          refreshLabel={refreshedAt ? `Cập nhật lúc ${saigonRefreshLabel(refreshedAt)}` : 'Đang tải…'}
          onRefresh={() => void run(() => load(true))}
          busy={busy}
          query={query}
          onQuery={setQuery}
          searchPlaceholder="Tìm tên, Page, số điện thoại, thẻ"
          searchAria="Tìm hội thoại"
          pills={[
            { id: 'all', label: 'Tất cả', count: desk?.messages.length ?? 0 },
            { id: 'unread', label: 'Chưa đọc', count: unreadCount },
            { id: 'unreplied', label: 'Chưa trả lời', count: unrepliedCount },
            { id: 'phone', label: 'Có SĐT', count: phoneCount },
            { id: 'mine', label: 'Của tôi', count: mineCount },
            { id: 'unassigned', label: 'Chưa gán', count: unassignedCount },
          ]}
          pillsAria="Lọc nhanh"
          activePill={quick}
          onPill={(id) => setQuick(id as typeof quick)}
          slots={[
            {
              key: 'page',
              aria: 'Lọc theo Page',
              emptyLabel: 'Page',
              value: pageId,
              onChange: setPageId,
              options: pages.map((page) => ({
                value: page.page_id,
                label: displayPageName(page.page_id, page.page_name),
              })),
            },
            {
              key: 'tag',
              aria: 'Lọc theo thẻ',
              emptyLabel: 'Thẻ',
              value: tag,
              onChange: setTag,
              options: (desk?.labels ?? []).map((item) => ({ value: item.name, label: item.name })),
            },
            {
              key: 'staff',
              aria: 'Lọc theo nhân viên',
              emptyLabel: desk?.me.role === 'staff' ? 'Của tôi' : 'Nhân viên',
              value: staffId,
              onChange: setStaffId,
              options: desk?.me.role === 'staff' ? [] : (desk?.staff ?? []).map((item) => ({ value: item.id, label: item.email })),
            },
          ]}
          filtering={filtering}
          onClear={() => {
            setQuery('');
            setPageId('');
            setTag('');
            setStaffId('');
            setQuick('all');
            setInfo('');
          }}
        />
        {ingestAlerts.length ? (
          <div className="tram-inbox__alert" role="alert">
            {ingestAlerts.map((line) => (
              <p key={line} style={{ margin: ingestAlerts.length > 1 ? '0.25rem 0' : 0 }}>
                {line}
              </p>
            ))}
          </div>
        ) : null}
        <div className="tram-inbox__rows" ref={listRef}>
          {!refreshedAt && !error ? <InboxSkeleton /> : null}
          {refreshedAt && threads.length === 0 ? (
            <div className="tram-inbox__empty">
              <p>
                <strong>Chưa có hội thoại phù hợp.</strong>
              </p>
              <p>
                {ingestAlerts.length
                  ? 'Xem thông báo phía trên: thường là thiếu quyền token hoặc Facebook từ chối đọc hội thoại.'
                  : filtering
                    ? 'Thử xóa bộ lọc hoặc tìm với từ khóa khác.'
                    : 'Hội thoại chỉ hiện sau khi Page đã gắn có tin khách gửi vào. Bấm Làm mới để đọc từ Facebook.'}
              </p>
            </div>
          ) : (
            threads.map((row) => {
              const contacts = threadContacts(row);
              const unread = isUnread(row);
              const name = row.title || 'Khách';
              return (
                <button
                  key={row.id}
                  type="button"
                  className={`tram-inbox__row${row.id === selectedId ? ' is-active' : ''}${unread ? ' is-unread' : ''}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <span className="tram-inbox__avatar" style={{ background: avatarTone(name) }} aria-hidden>
                    {initials(name)}
                  </span>
                  <span className="tram-inbox__row-body">
                    <span className="tram-inbox__row-top">
                      <strong>{name}</strong>
                      <time>{relativeTime(row.last_interaction_at || row.created_at)}</time>
                    </span>
                    <span className="tram-inbox__row-meta">
                      <span className="tram-inbox__page-badge">{displayPageName(row.page_id, pageName.get(row.page_id))}</span>
                      {unread ? <span className="tram-inbox__unread-dot" title="Chưa đọc" /> : null}
                      {isUnreplied(row) ? <span className="tram-inbox__unreplied">Chưa trả lời</span> : null}
                      {contacts.phones.length ? (
                        <span className="tram-inbox__phone-ico" title={`Có số ${contacts.phones[0]}`}>
                          ☎
                        </span>
                      ) : null}
                    </span>
                    <p className="tram-inbox__snippet">{row.snippet || 'Chưa có tin'}</p>
                    {row.labels.length ? (
                      <span className="tram-inbox__badges">
                        {row.labels.map((label) => (
                          <span
                            key={label}
                            className="tram-inbox__badge"
                            style={{ background: labelColor.get(label) || '#6366f1' }}
                          >
                            {label}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
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
                <button type="button" className="tram-inbox__back" onClick={() => setSelectedId('')}>
                  ← Danh sách
                </button>
                <div className="tram-inbox__thread-title">
                  <span className="tram-inbox__avatar is-md" style={{ background: avatarTone(detail.case.title || 'Khách') }}>
                    {initials(detail.case.title || 'Khách')}
                  </span>
                  <div>
                    <h2>{detail.case.title || 'Khách'}</h2>
                    <p className="tram-inbox__assign">
                      <span>{STATUS[detail.case.status] || detail.case.status}</span>
                      <span> · {detail.case.assignee_email || 'Chưa phân công'}</span>
                      <span> · {displayPageName(detail.case.page_id, pageName.get(detail.case.page_id))}</span>
                    </p>
                  </div>
                </div>
                {(desk?.me.role !== 'staff' || detail.case.assignee_user_id === desk?.me.id) &&
                detail.case.status !== 'purchased' ? (
                  <div className="tram-inbox__assign-actions">
                    {detail.case.status === 'waiting_receive' ? (
                      <button
                        type="button"
                        className="tram-inbox__btn"
                        disabled={busy}
                        onClick={() => void run(() => postPortalCase(token, detail.case.id, 'receive'))}
                      >
                        Nhận
                      </button>
                    ) : null}
                    {detail.case.status !== 'caring' ? (
                      <button
                        type="button"
                        className="tram-inbox__btn"
                        disabled={busy}
                        onClick={() => void run(() => postPortalCase(token, detail.case.id, 'care'))}
                      >
                        Xác nhận chăm sóc
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="tram-inbox__btn"
                        disabled={busy}
                        onClick={() => void run(() => postPortalCase(token, detail.case.id, 'purchase'))}
                      >
                        Mua hàng
                      </button>
                    )}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="tram-inbox__btn tram-inbox__side-toggle"
                  onClick={() => setSideOpen((v) => !v)}
                  aria-expanded={sideOpen}
                >
                  {sideOpen ? 'Ẩn thông tin' : 'Thông tin khách'}
                </button>
              </div>
            </header>
            {collide ? <p className="tram-inbox__collision" style={{ margin: '0 0.75rem 0.5rem' }}>{collide}</p> : null}
            <div className="tram-inbox__bubbles" ref={bubblesRef}>
              {detail.messages.length === 0 ? (
                <p className="tram-inbox__hint">Chưa có tin trong hội thoại này.</p>
              ) : (
                detail.messages.map((message) => {
                  const customer = message.direction !== 'out';
                  const media = splitMedia(message.body || '');
                  const images = messageImages(message.body || '', message.attachments);
                  return (
                    <article key={message.id} className={customer ? 'tram-inbox__bubble' : 'tram-inbox__bubble is-out'}>
                      <header>
                        <span>{customer ? 'Khách' : 'Page'}</span>
                        <time dateTime={message.received_at}>{absoluteTime(message.received_at)}</time>
                      </header>
                      {media.text ? <p>{media.text}</p> : !images.length ? <p>Không có chữ.</p> : null}
                      {images.length ? (
                        <div className="tram-inbox__media-list">
                          {images.map((src) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={src} src={src} alt="Ảnh trong tin nhắn" className="tram-inbox__media" />
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
            <form
              className="tram-inbox__reply is-sticky"
              onSubmit={(event) => {
                event.preventDefault();
                const text = reply;
                if (!text.trim()) return;
                void run(async () => {
                  await postPortalCase(token, detail.case.id, 'reply', { text });
                  setReply('');
                });
              }}
            >
              <label htmlFor="reply">Trả lời khách qua Page của hội thoại này — gõ “/” để dùng tin mẫu</label>
              {slashOpen && slashHits.length ? (
                <ul className="tram-inbox__slash" role="listbox" aria-label="Tin nhắn mẫu">
                  {slashHits.map((item, index) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={index === slashIdx ? 'is-on' : undefined}
                        onMouseEnter={() => setSlashIdx(index)}
                        onClick={() => applyTemplate(item)}
                      >
                        <strong>/{item.shortcut}</strong>
                        <span>{item.title}</span>
                        <em>{item.body}</em>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="tram-inbox__reply-row">
                <textarea
                  id="reply"
                  ref={replyRef}
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={(event) => {
                    if (slashOpen && slashHits.length) {
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setSlashIdx((i) => (i + 1) % slashHits.length);
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setSlashIdx((i) => (i - 1 + slashHits.length) % slashHits.length);
                      } else if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        applyTemplate(slashHits[slashIdx]);
                      } else if (event.key === 'Escape') {
                        setSlashOpen(false);
                      }
                      return;
                    }
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={2}
                  maxLength={2000}
                  placeholder="Nhập tin gửi khách, hoặc gõ / để chọn tin mẫu"
                />
                <button type="submit" className="tram-inbox__btn tram-inbox__btn--teal" disabled={busy || !reply.trim()}>
                  {busy ? 'Đang gửi' : 'Gửi'}
                </button>
              </div>
              <div className="tram-inbox__reply-actions">
                <PortalInboxQuickReplies
                  token={token}
                  items={templates}
                  busy={busy}
                  onUse={(item) => applyTemplate(item)}
                  onChange={(items) =>
                    setDesk((current) => (current ? { ...current, quick_replies: items } : current))
                  }
                />
                <span className="tram-inbox__hint" style={{ margin: 0 }}>
                  Enter gửi · Shift+Enter xuống dòng · “/” chọn mẫu
                </span>
              </div>
              <p className="tram-inbox__hint">
                Bấm Gửi thì tin đi tới Messenger của khách. Facebook chỉ nhận nếu khách còn nhắn trong 24 giờ gần nhất.
              </p>
              {error ? <p className="tram-inbox__error">{error}</p> : null}
            </form>
          </>
        ) : (
          <div className="tram-inbox__placeholder">
            <div>
              <h2>Chọn một hội thoại</h2>
              <p>Bấm một dòng bên trái. Nội dung tin hiện ở giữa, thông tin khách hiện bên phải.</p>
              {error ? <p className="tram-inbox__error">{error}</p> : null}
            </div>
          </div>
        )}
      </section>

      <aside className="tram-inbox__side">
        {detail ? (
          <div className="tram-inbox__side-body">
            <PortalInboxSideTabs value={sideTab} onChange={setSideTab} />
            <div className="tram-inbox__side-pane" hidden={sideTab !== 'khach'}>
            <section className="tram-inbox__side-section">
              <p className="tram-inbox__kicker">Khách</p>
              <div className="tram-inbox__identity">
                <span className="tram-inbox__avatar is-lg" style={{ background: avatarTone(detail.case.title || 'Khách') }}>
                  {initials(detail.case.title || 'Khách')}
                </span>
                <div>
                  <p>
                    <strong>{detail.case.title || 'Khách'}</strong>
                  </p>
                  <p className="tram-inbox__hint" style={{ margin: '0.15rem 0 0' }}>
                    {displayPageName(detail.case.page_id, pageName.get(detail.case.page_id))}
                  </p>
                </div>
              </div>
              {detectedPhones.length || detectedEmails.length ? (
                <ul className="tram-inbox__detect">
                  {detectedPhones.map((phone) => (
                    <li key={phone}>
                      <span>SĐT</span> {phone}
                    </li>
                  ))}
                  {detectedEmails.map((email) => (
                    <li key={email}>
                      <span>Email</span> {email}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tram-inbox__hint">Chưa thấy số điện thoại hay email trong hội thoại.</p>
              )}
            </section>

            <div>
              <p className="tram-inbox__kicker">Thẻ</p>
              <div className="tram-inbox__tag-wrap">
                {(desk?.labels ?? []).map((item) => {
                  const on = detail.case.labels.includes(item.name);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={on ? 'tram-inbox__tag is-on' : 'tram-inbox__tag'}
                      style={on ? { background: item.color, borderColor: item.color, color: '#fff' } : { borderColor: item.color, color: item.color }}
                      disabled={busy}
                      onClick={() => void run(() => postPortalCase(token, detail.case.id, 'label', { name: item.name, color: item.color }))}
                    >
                      {item.name}
                      {on ? ' ×' : ' +'}
                    </button>
                  );
                })}
              </div>
              <form
                className="tram-inbox__tag-add"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = newTag.trim();
                  if (!name) return;
                  const color = TAG_PALETTE[name.length % TAG_PALETTE.length];
                  void run(async () => {
                    await postPortalCase(token, detail.case.id, 'label', { name, color });
                    setNewTag('');
                  });
                }}
              >
                <input value={newTag} onChange={(event) => setNewTag(event.target.value)} maxLength={40} placeholder="Thêm thẻ mới" aria-label="Thêm thẻ" />
                <button type="submit" className="tram-inbox__btn" disabled={busy || !newTag.trim()}>
                  Thêm
                </button>
              </form>
            </div>

            <div>
              <p className="tram-inbox__kicker">Ghi chú nội bộ</p>
              <textarea
                className="tram-inbox__notes"
                value={notes}
                rows={4}
                maxLength={4000}
                placeholder="Ghi chú chỉ nhân viên thấy, không gửi cho khách"
                onChange={(event) => setNotes(event.target.value)}
                onBlur={() => {
                  if ((detail.case.notes ?? '') !== notes) {
                    void run(async () => {
                      await postPortalCaseNotes(token, detail.case.id, notes);
                    });
                  }
                }}
              />
            </div>

            </div>
            <div className="tram-inbox__side-pane" hidden={sideTab !== 'lead'}>
            <section className="tram-inbox__side-section">
              <p className="tram-inbox__kicker">Tạo Lead</p>
              {linkedLeads.length ? (
                <ul className="tram-inbox__lead-list">
                  {linkedLeads.map((lead) => (
                    <li key={lead.id} className="tram-inbox__lead-card">
                      <strong>{lead.full_name || 'Lead'}</strong>
                      <p>{displayVnPhone(lead.phone) || 'Chưa có số'}</p>
                      {lead.email ? <p>{lead.email}</p> : null}
                      {lead.campaign_name ? <p className="tram-inbox__hint">{lead.campaign_name}</p> : null}
                      <Link href="/crm/leads">Mở danh sách Lead</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tram-inbox__hint">Chưa có Lead trùng số điện thoại của hội thoại này.</p>
              )}
              <div className="tram-inbox__lead-form">
                <label className="tram-inbox__field">
                  <span>Tên Lead</span>
                  <input
                    value={leadForm.name}
                    maxLength={200}
                    onChange={(event) => setLeadForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label className="tram-inbox__field">
                  <span>Số điện thoại</span>
                  <input
                    value={leadForm.phone}
                    maxLength={40}
                    onChange={(event) => setLeadForm((current) => ({ ...current, phone: event.target.value }))}
                  />
                </label>
                <label className="tram-inbox__field">
                  <span>Email (không bắt buộc)</span>
                  <input
                    value={leadForm.email}
                    maxLength={200}
                    onChange={(event) => setLeadForm((current) => ({ ...current, email: event.target.value }))}
                  />
                </label>
                <button
                  type="button"
                  className="tram-inbox__btn tram-inbox__btn--teal"
                  disabled={busy || !leadForm.phone.trim()}
                  onClick={() =>
                    void run(async () => {
                      await postPortalCaseCreateLead(token, detail.case.id, {
                        full_name: leadForm.name,
                        phone: leadForm.phone,
                        email: leadForm.email,
                      });
                    })
                  }
                >
                  Tạo Lead
                </button>
                {!leadForm.phone.trim() ? (
                  <p className="tram-inbox__hint">Điền số điện thoại đã phát hiện (hoặc nhập tay) rồi tạo Lead.</p>
                ) : null}
              </div>
            </section>
            </div>
            <div className="tram-inbox__side-pane" hidden={sideTab !== 'chot'}>
            <section className="tram-inbox__side-section">
              <p className="tram-inbox__kicker">Chốt đơn</p>
              <PortalPosOrderForm
                token={token}
                compact
                confirmOnCreate
                prefill={{
                  phone: form.phone || detectedPhones[0] || '',
                  name: detail.case.title || '',
                  address: form.address,
                  page_id: detail.case.page_id,
                  case_id: detail.case.id,
                  source: 'inbox',
                  ad_id: detail.case.ad_id,
                  post_id: (detail.case as { post_id?: string }).post_id || '',
                }}
              />
            </section>

            </div>
            {collide ? <p className="tram-inbox__collision">{collide}</p> : null}
            <div className="tram-inbox__side-pane" hidden={sideTab !== 'khach'}>

            {desk?.me.role !== 'staff' && (desk?.staff.length ?? 0) > 0 && detail.case.status !== 'purchased' ? (
              <div>
                <p className="tram-inbox__kicker">Nhân viên phụ trách</p>
                <label className="tram-inbox__assign-pick">
                  <span>Gán cho</span>
                  <select
                    value={detail.case.assignee_user_id || ''}
                    disabled={busy}
                    aria-label="Gán cho nhân viên"
                    onChange={(event) => {
                      const user_id = event.target.value;
                      void run(() => postPortalCase(token, detail.case.id, 'assign', { user_id }));
                    }}
                  >
                    <option value="">Chưa gán</option>
                    {(desk?.staff ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.email}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <div>
                <p className="tram-inbox__kicker">Nhân viên phụ trách</p>
                <p>{detail.case.assignee_email || 'Chưa phân công'}</p>
              </div>
            )}

            <div>
              <p className="tram-inbox__kicker">Tin nhắn mẫu</p>
              <button type="button" className="tram-inbox__clear" onClick={() => setShowTemplates((v) => !v)}>
                {showTemplates ? 'Ẩn danh sách mẫu' : `Hiện ${templates.length} mẫu (phím /)`}
              </button>
              {showTemplates ? (
                <div className="tram-inbox__templates">
                  {templates.map((item) => (
                    <div key={item.id} className="tram-inbox__template">
                      <button type="button" className="tram-inbox__clear" onClick={() => applyTemplate(item)}>
                        /{item.shortcut} · {item.title}
                      </button>
                      <button
                        type="button"
                        className="tram-inbox__clear"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await deletePortalQuickReply(token, item.id);
                          })
                        }
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                  <form
                    className="tram-inbox__template-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(async () => {
                        await postPortalQuickReply(token, {
                          shortcut: templateForm.shortcut,
                          title: templateForm.title,
                          body: templateForm.body,
                        });
                        setTemplateForm({ shortcut: '', title: '', body: '' });
                      });
                    }}
                  >
                    <input
                      value={templateForm.shortcut}
                      onChange={(event) => setTemplateForm((c) => ({ ...c, shortcut: event.target.value }))}
                      placeholder="Phím tắt, ví dụ chao"
                      maxLength={40}
                      required
                    />
                    <input
                      value={templateForm.title}
                      onChange={(event) => setTemplateForm((c) => ({ ...c, title: event.target.value }))}
                      placeholder="Tên mẫu"
                      maxLength={80}
                    />
                    <textarea
                      value={templateForm.body}
                      onChange={(event) => setTemplateForm((c) => ({ ...c, body: event.target.value }))}
                      placeholder="Nội dung gửi khách"
                      rows={2}
                      required
                    />
                    <button type="submit" className="tram-inbox__btn" disabled={busy || !templateForm.shortcut || !templateForm.body}>
                      Lưu mẫu
                    </button>
                  </form>
                </div>
              ) : null}
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
                      onConfirm={(size, color) =>
                        void run(() =>
                          postPortalCase(token, detail.case.id, 'order', {
                            product_id: item.id,
                            size,
                            color,
                            phone: form.phone,
                            address: form.address,
                          }),
                        )
                      }
                      onSend={() => void run(() => postPortalCase(token, detail.case.id, 'send-product', { product_id: item.id }))}
                    />
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>
        ) : (
          <div className="tram-inbox__empty">Chọn một tin để xem khách, thẻ, ghi chú và Lead.</div>
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
  const selectionMatches = confirmed && confirmed.size === size && confirmed.color === resolvedColor;
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
            <button type="button" className="tram-inbox__btn tram-inbox__btn--teal" disabled={busy || !canAct} onClick={onSend}>
              Gửi cho khách
            </button>
          </div>
        </>
      }
    />
  );
}

