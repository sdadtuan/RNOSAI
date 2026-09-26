'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStaffAvatarBlob } from '@/components/account/useStaffAvatarBlob';
import { OpsNav } from '@/components/OpsNav';
import { getAccessToken, type StoredStaffUser } from '@/lib/auth';
import { staffDisplayInitials } from '@/lib/crm/rs-mobile-shell';

type RsMobileTopBarProps = {
  user: StoredStaffUser;
  pathname: string;
  onLogout: () => void;
  agencyUnread?: number;
  emailPendingApprovals?: number;
};

export function RsMobileTopBar({
  user,
  pathname,
  onLogout,
  agencyUnread,
  emailPendingApprovals,
}: RsMobileTopBarProps) {
  const [token, setToken] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const avatarUrl = useStaffAvatarBlob(token, Boolean(user.has_avatar), user.avatar_updated_at);
  const initials = staffDisplayInitials(user.display_name || user.email);

  useEffect(() => {
    setToken(getAccessToken());
  }, [user.email]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen && !accountOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNavOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen, accountOpen]);

  return (
    <>
      <header className="rs-mobile-topbar">
        <button
          type="button"
          className="rs-mobile-topbar__menu"
          aria-label="Menu"
          aria-expanded={navOpen}
          onClick={() => {
            setAccountOpen(false);
            setNavOpen((open) => !open);
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
        <button
          type="button"
          className="rs-mobile-topbar__avatar"
          aria-label="Tài khoản"
          aria-expanded={accountOpen}
          onClick={() => {
            setNavOpen(false);
            setAccountOpen((open) => !open);
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            <span>{initials}</span>
          )}
        </button>
      </header>
      {navOpen ? (
        <button type="button" className="rs-mobile-scrim" aria-label="Đóng" onClick={() => setNavOpen(false)} />
      ) : null}
      {navOpen ? (
        <OpsNav
          user={user}
          onLogout={onLogout}
          variant="phone"
          onClose={() => setNavOpen(false)}
          agencyUnread={agencyUnread}
          emailPendingApprovals={emailPendingApprovals}
        />
      ) : null}
      {accountOpen ? (
        <button type="button" className="rs-mobile-scrim" aria-label="Đóng" onClick={() => setAccountOpen(false)} />
      ) : null}
      {accountOpen ? (
        <div className="rs-mobile-account" role="menu">
          <p className="rs-mobile-account__name">{user.display_name || user.email}</p>
          <p className="rs-mobile-account__email">{user.email}</p>
          <Link href="/account" role="menuitem" onClick={() => setAccountOpen(false)}>
            Tài khoản
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAccountOpen(false);
              onLogout();
            }}
          >
            Đăng xuất
          </button>
        </div>
      ) : null}
    </>
  );
}
