'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { StoredStaffUser } from '@/lib/auth';
import { useStaffAvatarBlob } from './useStaffAvatarBlob';

type StaffAvatarMenuProps = {
  user: StoredStaffUser | null;
  token: string | null;
  initials: string;
  onLogout: () => void;
};

export function StaffAvatarMenu({ user, token, initials, onLogout }: StaffAvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const avatarUrl = useStaffAvatarBlob(token, Boolean(user?.has_avatar), user?.avatar_updated_at);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="ops-topbar-user-menu" ref={rootRef}>
      <button
        type="button"
        className="ops-topbar-user-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ops-topbar-avatar" aria-hidden="true">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="ops-topbar-avatar-img" />
          ) : (
            initials
          )}
        </span>
        <strong>{user?.display_name ?? user?.email ?? 'Staff'}</strong>
      </button>
      {open ? (
        <div className="ops-topbar-user-dropdown" role="menu">
          <Link href="/account" role="menuitem" className="ops-topbar-user-dropdown__item" onClick={() => setOpen(false)}>
            Tài khoản
          </Link>
          <button
            type="button"
            role="menuitem"
            className="ops-topbar-user-dropdown__item"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  );
}
