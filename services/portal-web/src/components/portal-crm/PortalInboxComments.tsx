'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  fetchPortalComments,
  postPortalCommentCreateLead,
  postPortalCommentHide,
  postPortalCommentReply,
  type PortalCommentsResponse,
  type PortalFbPost,
  type PortalPageComment,
} from '@/lib/api';
import {
  absoluteTime,
  avatarTone,
  displayPageName,
  displayVnPhone,
  extractContacts,
  initials,
  relativeTime,
} from '@/components/portal-crm/portal-inbox.util';
import { PortalInboxListHeader } from '@/components/portal-crm/PortalInboxListHeader';
import { PortalInboxSideTabs, type InboxSideTab } from '@/components/portal-crm/PortalInboxSideTabs';
import { PortalPosOrderForm } from '@/components/portal-pos/PortalPosOrderForm';
import { setPortalTitleOverride } from '@/lib/portal/nav';

type Filter = 'all' | 'unreplied' | 'phone' | 'hidden';

export function PortalInboxComments({
  token,
  tabs,
  headerActions,
}: {
  token: string;
  tabs?: ReactNode;
  headerActions?: ReactNode;
}) {
  const [data, setData] = useState<PortalCommentsResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [pageId, setPageId] = useState('');
  const [query, setQuery] = useState('');
  const [postId, setPostId] = useState('');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    setPortalTitleOverride('Bình luận');
    return () => setPortalTitleOverride(null);
  }, []);
  const [reply, setReply] = useState('');
  const [mode, setMode] = useState<'public' | 'private'>('public');
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', email: '' });
  const [leadOk, setLeadOk] = useState('');
  const [info, setInfo] = useState('');
  const [sideTab, setSideTab] = useState<InboxSideTab>('chot');

  const load = useCallback(
    async (sync = false) => {
      // Never pass page_id here: changing the Page filter must not trigger Graph.
      // Sync only on first open and on "Làm mới"; the server also applies a 3-minute TTL.
      const next = await fetchPortalComments(token, { sync });
      setData(next);
      setSyncedAt(new Date());
      setError('');
    },
    [token],
  );

  useEffect(() => {
    void load(true).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Không tải được bình luận'),
    );
  }, [load]);

  const pageName = new Map((data?.pages ?? []).map((page) => [page.page_id, page.page_name || page.page_id]));
  const posts = useMemo(() => {
    const map = new Map((data?.posts ?? []).map((post) => [post.post_id, post]));
    return map;
  }, [data?.posts]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.comments ?? []).filter((row) => {
      if (pageId && row.page_id !== pageId) return false;
      if (postId && row.post_id !== postId) return false;
      const phones = extractContacts(row.message).phones;
      if (filter === 'unreplied' && (row.replied || Boolean(row.parent_id))) return false;
      if (filter === 'phone' && !phones.length) return false;
      if (filter === 'hidden' && !row.is_hidden) return false;
      if (!needle) return true;
      const post = posts.get(row.post_id);
      const blob = `${row.from_name} ${row.message} ${post?.message || ''} ${pageName.get(row.page_id) || ''}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [data, filter, pageId, postId, query, posts, pageName]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byPost = new Map<string, PortalPageComment[]>();
    for (const row of filtered) {
      if (!byPost.has(row.post_id)) {
        byPost.set(row.post_id, []);
        order.push(row.post_id);
      }
      byPost.get(row.post_id)!.push(row);
    }
    for (const list of byPost.values()) {
      list.sort((a, b) => String(b.created_time).localeCompare(String(a.created_time)));
    }
    return order.map((id) => ({
      post: posts.get(id) ?? emptyPost(id, byPost.get(id)?.[0]?.page_id || ''),
      comments: byPost.get(id) ?? [],
    }));
  }, [filtered, posts]);

  const selected = (data?.comments ?? []).find((row) => row.comment_id === selectedId) ?? null;
  const thread = useMemo(() => {
    if (!selected || !data) return [];
    const rootId = selected.parent_id || selected.comment_id;
    const root = data.comments.find((row) => row.comment_id === rootId) ?? selected;
    const replies = data.comments
      .filter((row) => row.parent_id === root.comment_id)
      .sort((a, b) => String(a.created_time).localeCompare(String(b.created_time)));
    return [root, ...replies.filter((row) => row.comment_id !== root.comment_id)];
  }, [selected, data]);

  useEffect(() => {
    if (selectedId) return;
    const first = filtered.find((row) => !row.parent_id) ?? filtered[0];
    if (first) setSelectedId(first.comment_id);
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selected) return;
    const phones = extractContacts(selected.message).phones;
    setLeadForm({
      name: selected.from_name || '',
      phone: phones[0] || '',
      email: extractContacts(selected.message).emails[0] || '',
    });
    setLeadOk('');
    setReply('');
    setInfo('');
  }, [selected?.comment_id]);

  const counts = {
    all: data?.comments.length ?? 0,
    unreplied: (data?.comments ?? []).filter((row) => !row.replied && !row.parent_id).length,
    phone: (data?.comments ?? []).filter((row) => extractContacts(row.message).phones.length).length,
    hidden: (data?.comments ?? []).filter((row) => row.is_hidden).length,
  };

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await task();
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được');
    } finally {
      setBusy(false);
    }
  }

  const permission = data?.permission_error?.trim() || '';
  const otherError = data?.error?.trim() || '';

  return (
    <div className={selectedId ? 'tram-inbox is-open is-pancake is-comments' : 'tram-inbox is-pancake is-comments'}>
      <section className="tram-inbox__list">
        <PortalInboxListHeader
          tabs={tabs}
          title="Bình luận"
          countLabel={`${filtered.length} / ${data?.comments.length ?? 0} bình luận`}
          headerActions={headerActions}
          refreshLabel={
            syncedAt
              ? `Cập nhật lúc ${syncedAt.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Đang tải…'
          }
          onRefresh={() => void run(() => load(true))}
          busy={busy}
          query={query}
          onQuery={setQuery}
          searchPlaceholder="Tìm người gửi, nội dung, bài viết"
          searchAria="Tìm bình luận"
          pills={[
            { id: 'all', label: 'Tất cả', count: counts.all },
            { id: 'unreplied', label: 'Chưa trả lời', count: counts.unreplied },
            { id: 'phone', label: 'Có SĐT', count: counts.phone },
            { id: 'hidden', label: 'Đã ẩn', count: counts.hidden },
          ]}
          pillsAria="Lọc bình luận"
          activePill={filter}
          onPill={(id) => setFilter(id as Filter)}
          slots={[
            {
              key: 'page',
              aria: 'Lọc theo Page',
              emptyLabel: 'Page',
              value: pageId,
              onChange: setPageId,
              options: (data?.pages ?? []).map((page) => ({
                value: page.page_id,
                label: displayPageName(page.page_id, page.page_name),
              })),
            },
            {
              key: 'status',
              aria: 'Lọc theo trạng thái',
              emptyLabel: 'Trạng thái',
              value: filter === 'all' ? '' : filter,
              onChange: (value) => setFilter((value || 'all') as Filter),
              options: [
                { value: 'unreplied', label: 'Chưa trả lời' },
                { value: 'phone', label: 'Có SĐT' },
                { value: 'hidden', label: 'Đã ẩn' },
              ],
            },
            {
              key: 'post',
              aria: 'Lọc theo bài viết',
              emptyLabel: 'Bài viết',
              value: postId,
              onChange: setPostId,
              options: (data?.posts ?? []).map((post) => ({
                value: post.post_id,
                label: (post.message || 'Bài không có chữ').slice(0, 48),
              })),
            },
          ]}
          filtering={Boolean(query || pageId || postId || filter !== 'all')}
          onClear={() => {
            setQuery('');
            setPageId('');
            setPostId('');
            setFilter('all');
          }}
        />
        {permission ? (
          <div className="tram-inbox__alert" role="alert">
            <p>{permission}</p>
          </div>
        ) : null}
        {otherError && !permission ? (
          <div className="tram-inbox__alert" role="alert">
            <p>{otherError}</p>
          </div>
        ) : null}
        {error ? <p className="tram-inbox__error" style={{ margin: '0.5rem 0.75rem' }}>{error}</p> : null}
        <div className="tram-inbox__rows">
          {!syncedAt && !error && !permission ? <InboxSkeleton /> : null}
          {syncedAt && groups.length === 0 ? (
            <div className="tram-inbox__empty">
              <p>
                <strong>{permission ? 'Chưa đọc được bình luận.' : 'Chưa có bình luận phù hợp.'}</strong>
              </p>
              <p>
                {permission
                  ? 'Xin quyền Meta ở thông báo phía trên, rồi bấm Làm mới.'
                  : 'Bình luận hiện khi Page có bài viết. Bấm Làm mới để cập nhật.'}
              </p>
            </div>
          ) : null}
          {groups.map((group) => (
            <div key={group.post.post_id} className="tram-inbox__post-group">
              <PostPreview post={group.post} pageLabel={displayPageName(group.post.page_id, pageName.get(group.post.page_id))} />
              {group.comments
                .filter((row) => !row.parent_id)
                .map((row) => {
                  const phones = extractContacts(row.message).phones;
                  const replies = group.comments.filter((item) => item.parent_id === row.comment_id).length;
                  return (
                    <button
                      key={row.comment_id}
                      type="button"
                      className={`tram-inbox__row${row.comment_id === selectedId ? ' is-active' : ''}${!row.replied ? ' is-unread' : ''}`}
                      onClick={() => setSelectedId(row.comment_id)}
                    >
                      <span className="tram-inbox__avatar" style={{ background: avatarTone(row.from_name || 'Khách') }} aria-hidden>
                        {initials(row.from_name || 'Khách')}
                      </span>
                      <span className="tram-inbox__row-body">
                        <span className="tram-inbox__row-top">
                          <strong>{row.from_name || 'Khách'}</strong>
                          <time dateTime={row.created_time}>{relativeTime(row.created_time)}</time>
                        </span>
                        <span className="tram-inbox__row-meta">
                          {!row.replied ? <span className="tram-inbox__unreplied">Chưa trả lời</span> : <span className="tram-inbox__hint" style={{ margin: 0 }}>Đã trả lời</span>}
                          {phones.length ? (
                            <span className="tram-inbox__phone-ico" title={`Có số ${phones[0]}`}>
                              SĐT
                            </span>
                          ) : null}
                          {row.is_hidden ? <span className="tram-inbox__hidden-badge">Đã ẩn</span> : null}
                          {replies ? <span className="tram-inbox__hint" style={{ margin: 0 }}>{replies} trả lời</span> : null}
                        </span>
                        <p className="tram-inbox__snippet">{row.message || '(Không có chữ)'}</p>
                      </span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </section>

      <section className="tram-inbox__thread">
        {selected ? (
          <>
            <header className="tram-inbox__thread-head">
              <div className="tram-inbox__thread-head-main">
                <div className="tram-inbox__thread-title">
                  <span className="tram-inbox__avatar is-md" style={{ background: avatarTone(selected.from_name || 'Khách') }}>
                    {initials(selected.from_name || 'Khách')}
                  </span>
                  <div>
                    <h2>{selected.from_name || 'Khách'}</h2>
                    <p className="tram-inbox__assign">{displayPageName(selected.page_id, pageName.get(selected.page_id))}</p>
                  </div>
                </div>
              </div>
            </header>
            <div className="tram-inbox__bubbles">
              <PostPreview post={posts.get(selected.post_id) ?? emptyPost(selected.post_id, selected.page_id)} pageLabel={displayPageName(selected.page_id, pageName.get(selected.page_id))} large />
              {thread.map((row) => {
                const phones = extractContacts(row.message).phones;
                const isPage = row.from_id === selected.page_id || row.from_name.toLowerCase().includes('page');
                return (
                  <article
                    key={row.comment_id}
                    className={row.parent_id ? 'tram-inbox__bubble is-reply' : 'tram-inbox__bubble'}
                    data-comment-id={row.comment_id}
                  >
                    <header>
                      <span>{row.from_name || (isPage ? 'Page' : 'Khách')}</span>
                      <time dateTime={row.created_time}>{absoluteTime(row.created_time)}</time>
                    </header>
                    <p>{row.message || '(Không có chữ)'}</p>
                    <div className="tram-inbox__bubble-flags">
                      {phones.length ? <span className="tram-inbox__phone-ico">SĐT {phones[0]}</span> : null}
                      {row.is_hidden ? <span className="tram-inbox__hidden-badge">Đã ẩn</span> : null}
                      {row.replied && !row.parent_id ? <span className="tram-inbox__hint" style={{ margin: 0 }}>Đã trả lời</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
            <form
              className="tram-inbox__reply is-sticky"
              onSubmit={(event) => {
                event.preventDefault();
                const text = reply.trim();
                if (!text) return;
                void run(async () => {
                  await postPortalCommentReply(token, selected.comment_id, { text, mode });
                  setReply('');
                  setInfo(mode === 'private' ? 'Đã gửi trả lời riêng trên Messenger.' : 'Đã trả lời công khai.');
                });
              }}
            >
              <label htmlFor="comment-reply">Trả lời bình luận — công khai trên bài viết, hoặc riêng qua Messenger</label>
              <div className="tram-inbox__mode">
                <label>
                  <input type="radio" name="comment-mode" checked={mode === 'public'} onChange={() => setMode('public')} />
                  Công khai
                </label>
                <label>
                  <input
                    type="radio"
                    name="comment-mode"
                    checked={mode === 'private'}
                    onChange={() => setMode('private')}
                    disabled={!selected.can_reply_privately}
                  />
                  Riêng tư (Messenger)
                </label>
              </div>
              <div className="tram-inbox__reply-row">
                <textarea
                  id="comment-reply"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={2}
                  maxLength={2000}
                  placeholder="Nhập trả lời. Enter để gửi, Shift+Enter xuống dòng."
                />
                <button type="submit" className="tram-inbox__btn tram-inbox__btn--teal" disabled={busy || !reply.trim()}>
                  {busy ? 'Đang gửi' : 'Gửi'}
                </button>
              </div>
              <div className="tram-inbox__reply-actions">
                <button
                  type="button"
                  className="tram-inbox__btn"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await postPortalCommentHide(token, selected.comment_id, !selected.is_hidden);
                    })
                  }
                >
                  {selected.is_hidden ? 'Bỏ ẩn' : 'Ẩn bình luận'}
                </button>
              </div>
              <p className="tram-inbox__hint">
                Trả lời công khai hiện ngay dưới bình luận trên Page. Trả lời riêng gửi vào Messenger của khách. Ẩn thì khách không còn thấy bình luận đó.
              </p>
              {info ? <p className="tram-inbox__ok">{info}</p> : null}
              {error ? <p className="tram-inbox__error">{error}</p> : null}
            </form>
          </>
        ) : (
          <div className="tram-inbox__placeholder">
            <div>
              <h2>Chọn một bình luận</h2>
              <p>Bài viết và luồng trả lời hiện ở giữa. Tạo Lead từ số điện thoại ở cột phải.</p>
            </div>
          </div>
        )}
      </section>

      <aside className="tram-inbox__side">
        {selected ? (
          <div className="tram-inbox__side-body">
            <PortalInboxSideTabs value={sideTab} onChange={setSideTab} />
            <div className="tram-inbox__side-pane" hidden={sideTab !== 'khach'}>
            <p className="tram-inbox__kicker">Khách</p>
            <div className="tram-inbox__identity">
              <span className="tram-inbox__avatar is-lg" style={{ background: avatarTone(selected.from_name || 'Khách') }}>
                {initials(selected.from_name || 'Khách')}
              </span>
              <div>
                <strong>{selected.from_name || 'Khách'}</strong>
                <p className="tram-inbox__hint" style={{ margin: '0.15rem 0 0' }}>
                  {displayPageName(selected.page_id, pageName.get(selected.page_id))}
                </p>
              </div>
            </div>
            {extractContacts(selected.message).phones.length ? (
              <ul className="tram-inbox__detect">
                {extractContacts(selected.message).phones.map((phone) => (
                  <li key={phone}>
                    <span className="tram-inbox__phone-ico">SĐT</span> {phone}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tram-inbox__hint">Không thấy số điện thoại trong bình luận này.</p>
            )}
            </div>
            <div className="tram-inbox__side-pane" hidden={sideTab !== 'lead'}>
            <p className="tram-inbox__kicker">Tạo Lead</p>
            <div className="tram-inbox__lead-form">
              <label className="tram-inbox__field">
                <span>Tên</span>
                <input value={leadForm.name} onChange={(event) => setLeadForm((c) => ({ ...c, name: event.target.value }))} />
              </label>
              <label className="tram-inbox__field">
                <span>Số điện thoại</span>
                <input
                  value={leadForm.phone}
                  onChange={(event) => setLeadForm((c) => ({ ...c, phone: displayVnPhone(event.target.value) }))}
                />
              </label>
              <label className="tram-inbox__field">
                <span>Email</span>
                <input value={leadForm.email} onChange={(event) => setLeadForm((c) => ({ ...c, email: event.target.value }))} />
              </label>
              <button
                type="button"
                className="tram-inbox__btn tram-inbox__btn--teal"
                disabled={busy || !leadForm.phone.trim()}
                onClick={() =>
                  void run(async () => {
                    await postPortalCommentCreateLead(token, selected.comment_id, {
                      full_name: leadForm.name,
                      phone: leadForm.phone,
                      email: leadForm.email,
                    });
                    setLeadOk('Đã tạo Lead từ bình luận. Xem ở trang Lead và cột phải khi mở lại.');
                  })
                }
              >
                Tạo Lead
              </button>
              {leadOk ? <p className="tram-inbox__ok">{leadOk}</p> : null}
            </div>
            </div>
            <div className="tram-inbox__side-pane" hidden={sideTab !== 'chot'}>
            <p className="tram-inbox__kicker">Chốt đơn</p>
            <PortalPosOrderForm
              token={token}
              compact
              confirmOnCreate
              prefill={{
                phone: leadForm.phone || extractContacts(selected.message).phones[0] || '',
                name: selected.from_name || leadForm.name || '',
                page_id: selected.page_id,
                comment_id: selected.comment_id,
                source: 'comment',
                post_id: selected.post_id || '',
              }}
            />
            </div>
          </div>
        ) : (
          <div className="tram-inbox__empty">Chọn bình luận để tạo Lead, chốt đơn hoặc xem số điện thoại.</div>
        )}
      </aside>
    </div>
  );
}

function emptyPost(postId: string, pageId: string): PortalFbPost {
  return { post_id: postId, page_id: pageId, message: '', permalink: '', picture: '', created_time: '' };
}

function PostPreview({
  post,
  pageLabel,
  large,
}: {
  post: PortalFbPost;
  pageLabel: string;
  large?: boolean;
}) {
  return (
    <article className={large ? 'tram-inbox__post-card is-large' : 'tram-inbox__post-card'}>
      {post.picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.picture} alt="" className="tram-inbox__post-pic" />
      ) : (
        <span className="tram-inbox__post-pic is-empty" aria-hidden />
      )}
      <div>
        <p className="tram-inbox__hint" style={{ margin: 0 }}>
          {pageLabel}
          {post.created_time ? ` · ${relativeTime(post.created_time)}` : ''}
        </p>
        <p className="tram-inbox__post-msg">{post.message || 'Bài viết không có chữ.'}</p>
        {post.permalink ? (
          <a href={post.permalink} target="_blank" rel="noreferrer" className="tram-inbox__clear">
            Mở bài viết
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function InboxSkeleton() {
  return (
    <div className="tram-inbox__skeleton" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="tram-inbox__skel-row">
          <span className="tram-inbox__skel-avatar" />
          <span className="tram-inbox__skel-lines">
            <em />
            <em />
          </span>
        </div>
      ))}
    </div>
  );
}
