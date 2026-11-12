'use client';

import { useState } from 'react';
import {
  deletePortalQuickReply,
  fetchPortalQuickReplies,
  patchPortalQuickReply,
  postPortalQuickRepliesReorder,
  postPortalQuickReply,
  type PortalQuickReply,
} from '@/lib/api';

export function PortalInboxQuickReplies({
  token,
  items,
  onChange,
  onUse,
  busy,
}: {
  token: string;
  items: PortalQuickReply[];
  onChange: (items: PortalQuickReply[]) => void;
  onUse?: (item: PortalQuickReply) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ shortcut: '', title: '', body: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ shortcut: '', title: '', body: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const data = await fetchPortalQuickReplies(token);
    onChange(data.quick_replies ?? []);
  }

  async function run(task: () => Promise<void>) {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await task();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được mẫu');
    } finally {
      setSaving(false);
    }
  }

  async function move(id: string, dir: -1 | 1) {
    const ids = items.map((item) => item.id);
    const index = ids.indexOf(id);
    const next = index + dir;
    if (index < 0 || next < 0 || next >= ids.length) return;
    const copy = [...ids];
    const [picked] = copy.splice(index, 1);
    copy.splice(next, 0, picked);
    await run(async () => {
      await postPortalQuickRepliesReorder(token, copy);
    });
  }

  return (
    <div className="tram-inbox__qr">
      <button
        type="button"
        className="tram-inbox__icon-btn"
        onClick={() => setOpen(true)}
        aria-label="Quản lý mẫu"
        title="Quản lý mẫu tin nhắn"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3 3.5h10v2.2H3V3.5Zm0 3.4h10v2.2H3V6.9Zm0 3.4h7V12.5H3v-2.2Z" fill="currentColor" />
          <path d="M11.2 10.2v1.6h1.6v1.2h-1.6V14.6h-1.2v-1.6H10v-1.2h1.2v-1.6h1.2Z" fill="currentColor" />
        </svg>
        <span>Mẫu</span>
      </button>
      {open ? (
        <div
          className="tram-inbox__modal-back"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="tram-inbox__modal" role="dialog" aria-labelledby="qr-title">
            <header>
              <h2 id="qr-title">Tin nhắn mẫu</h2>
              <button type="button" className="tram-inbox__clear" onClick={() => setOpen(false)}>
                Đóng
              </button>
            </header>
            <p className="tram-inbox__hint">
              Gõ “/” trong ô trả lời để chèn mẫu. Dùng Lên/Xuống để đổi thứ tự.
            </p>
            {error ? <p className="tram-inbox__error">{error}</p> : null}
            <ul className="tram-inbox__qr-list">
              {items.length === 0 ? <li className="tram-inbox__hint">Chưa có mẫu nào.</li> : null}
              {items.map((item, index) => (
                <li key={item.id} className="tram-inbox__qr-item">
                  {editing === item.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void run(async () => {
                          await patchPortalQuickReply(token, item.id, edit);
                          setEditing(null);
                        });
                      }}
                    >
                      <input
                        value={edit.shortcut}
                        onChange={(event) => setEdit((c) => ({ ...c, shortcut: event.target.value }))}
                        placeholder="Phím tắt"
                        required
                        maxLength={40}
                      />
                      <input
                        value={edit.title}
                        onChange={(event) => setEdit((c) => ({ ...c, title: event.target.value }))}
                        placeholder="Tên mẫu"
                        maxLength={80}
                      />
                      <textarea
                        value={edit.body}
                        onChange={(event) => setEdit((c) => ({ ...c, body: event.target.value }))}
                        rows={2}
                        required
                      />
                      <div className="tram-inbox__qr-actions">
                        <button type="submit" className="tram-inbox__btn tram-inbox__btn--teal" disabled={saving}>
                          Lưu
                        </button>
                        <button type="button" className="tram-inbox__btn" onClick={() => setEditing(null)}>
                          Hủy
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div>
                        <strong>/{item.shortcut}</strong> · {item.title || 'Không tên'}
                        <p>{item.body}</p>
                      </div>
                      <div className="tram-inbox__qr-actions">
                        {onUse ? (
                          <button
                            type="button"
                            className="tram-inbox__clear"
                            onClick={() => {
                              onUse(item);
                              setOpen(false);
                            }}
                          >
                            Dùng
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="tram-inbox__clear"
                          disabled={index === 0 || saving}
                          onClick={() => void move(item.id, -1)}
                        >
                          Lên
                        </button>
                        <button
                          type="button"
                          className="tram-inbox__clear"
                          disabled={index === items.length - 1 || saving}
                          onClick={() => void move(item.id, 1)}
                        >
                          Xuống
                        </button>
                        <button
                          type="button"
                          className="tram-inbox__clear"
                          onClick={() => {
                            setEditing(item.id);
                            setEdit({ shortcut: item.shortcut, title: item.title, body: item.body });
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="tram-inbox__clear"
                          disabled={saving || busy}
                          onClick={() =>
                            void run(async () => {
                              await deletePortalQuickReply(token, item.id);
                            })
                          }
                        >
                          Xóa
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <form
              className="tram-inbox__template-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await postPortalQuickReply(token, form);
                  setForm({ shortcut: '', title: '', body: '' });
                });
              }}
            >
              <h3>Thêm mẫu mới</h3>
              <input
                value={form.shortcut}
                onChange={(event) => setForm((c) => ({ ...c, shortcut: event.target.value }))}
                placeholder="Phím tắt, ví dụ chao"
                maxLength={40}
                required
              />
              <input
                value={form.title}
                onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))}
                placeholder="Tên mẫu"
                maxLength={80}
              />
              <textarea
                value={form.body}
                onChange={(event) => setForm((c) => ({ ...c, body: event.target.value }))}
                placeholder="Nội dung gửi khách"
                rows={2}
                required
              />
              <button type="submit" className="tram-inbox__btn tram-inbox__btn--teal" disabled={saving || !form.shortcut || !form.body}>
                Tạo mẫu
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
