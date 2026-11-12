'use client';

import { useEffect, useState } from 'react';
import { fetchPortalInboxSettings, patchPortalInboxSettings } from '@/lib/api';

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6.5 1.6h3l.4 1.6a4.8 4.8 0 0 1 1.3.7l1.6-.5 1.5 2.6-1.2 1.1c.1.4.1.8.1 1.2s0 .8-.1 1.2l1.2 1.1-1.5 2.6-1.6-.5a4.8 4.8 0 0 1-1.3.7l-.4 1.6h-3l-.4-1.6a4.8 4.8 0 0 1-1.3-.7l-1.6.5-1.5-2.6 1.2-1.1A5 5 0 0 1 2.9 8c0-.4 0-.8.1-1.2L1.8 5.7 3.3 3.1l1.6.5a4.8 4.8 0 0 1 1.3-.7l.3-1.3Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function PortalInboxSettings({ token, canEdit }: { token: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [autoHide, setAutoHide] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchPortalInboxSettings(token)
      .then((data) => {
        if (!cancelled) setAutoHide(data.auto_hide_phone_comments === true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được cài đặt');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <>
      <button
        type="button"
        className={open ? 'tram-inbox__icon-btn is-on' : 'tram-inbox__icon-btn'}
        aria-label="Cài đặt hộp thư"
        title="Cài đặt hộp thư"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <GearIcon />
        <span className="tram-inbox__icon-sr">Cài đặt</span>
      </button>
      {open ? (
        <div
          className="tram-inbox__modal-back"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="tram-inbox__modal is-narrow" role="dialog" aria-labelledby="inbox-settings-title">
            <header>
              <h2 id="inbox-settings-title">Cài đặt hộp thư</h2>
              <button type="button" className="tram-inbox__clear" onClick={() => setOpen(false)}>
                Đóng
              </button>
            </header>
            <label className="tram-inbox__toggle">
              <input
                type="checkbox"
                checked={autoHide}
                disabled={!canEdit || busy}
                onChange={(event) => {
                  const next = event.target.checked;
                  if (next) {
                    const ok = window.confirm(
                      'Bật sẽ tự ẩn bình luận có số điện thoại trên Page khi bạn bấm Làm mới ở tab Bình luận. Mặc định là tắt. Chỉ bật khi bạn chắc chắn.',
                    );
                    if (!ok) return;
                  }
                  setBusy(true);
                  setError('');
                  setSaved('');
                  void patchPortalInboxSettings(token, next)
                    .then((data) => {
                      setAutoHide(data.auto_hide_phone_comments === true);
                      setSaved(next ? 'Đã bật tự ẩn bình luận có số điện thoại.' : 'Đã tắt tự ẩn.');
                    })
                    .catch((err: unknown) => {
                      setError(err instanceof Error ? err.message : 'Không lưu được cài đặt');
                    })
                    .finally(() => setBusy(false));
                }}
              />
              <span>Tự ẩn bình luận có số điện thoại</span>
            </label>
            <p className="tram-inbox__hint" style={{ margin: 0 }}>
              Mặc định tắt. Khi bật, mỗi lần làm mới tab Bình luận, các bình luận còn hiện và chứa số điện thoại sẽ được ẩn trên Page.
            </p>
            {error ? <p className="tram-inbox__error">{error}</p> : null}
            {saved ? <p className="tram-inbox__ok">{saved}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
