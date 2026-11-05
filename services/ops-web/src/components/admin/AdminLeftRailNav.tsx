'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  buildAdminNavGroups,
  type AdminNavGroup,
  type AdminNavGroupId,
} from '@/lib/admin/admin-nav';
import type { StoredStaffUser } from '@/lib/auth';

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin/crm/permissions') {
    return pathname === href;
  }
  if (href === '/admin') {
    return pathname === href;
  }
  const base = href.split('?')[0] || href;
  return pathname === base || pathname.startsWith(`${base}/`);
}

function groupContainsPath(group: AdminNavGroup, pathname: string): boolean {
  return group.links.some((link) => isActive(pathname, link.href));
}

type AdminLeftRailNavProps = {
  user: StoredStaffUser | null;
  className?: string;
  onNavigate?: () => void;
};

export function AdminLeftRailNav({ user, className, onNavigate }: AdminLeftRailNavProps) {
  const pathname = usePathname() ?? '';
  const groups = useMemo(() => buildAdminNavGroups(user), [user]);
  const [openIds, setOpenIds] = useState<AdminNavGroupId[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const activeIds = groups
      .filter((group) => groupContainsPath(group, pathname))
      .map((group) => group.id);
    setOpenIds((prev) => {
      if (!ready) return activeIds;
      const next = new Set(prev);
      for (const id of activeIds) next.add(id);
      return [...next];
    });
    setReady(true);
  }, [groups, pathname, ready]);

  function toggleGroup(id: AdminNavGroupId) {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  if (!groups.length) return null;

  const hubActive = pathname === '/admin';

  return (
    <nav className={className} aria-label="Quản trị hệ thống">
      <Link
        href="/admin"
        className={`admin-cp-rail__hub${hubActive ? ' admin-cp-rail__hub--active' : ''}`}
        aria-current={hubActive ? 'page' : undefined}
        onClick={onNavigate}
      >
        <span className="admin-cp-rail__hub-icon" aria-hidden>
          ⚙
        </span>
        <span>
          <strong>Control Plane</strong>
          <span className="muted admin-cp-rail__hub-sub">Quản trị hệ thống</span>
        </span>
      </Link>

      {groups.map((group) => {
        const open = ready ? openIds.includes(group.id) : groupContainsPath(group, pathname);
        const hasActive = groupContainsPath(group, pathname);
        return (
          <div
            key={group.id}
            className={`admin-cp-rail__group${open ? ' is-open' : ''}${hasActive ? ' has-active' : ''}`}
          >
            <button
              type="button"
              className="admin-cp-rail__group-header"
              aria-expanded={open}
              onClick={() => toggleGroup(group.id)}
            >
              <span className="admin-cp-rail__group-label">{group.label}</span>
              <span className="admin-cp-rail__group-toggle" aria-hidden>
                ▾
              </span>
            </button>
            <div className="admin-cp-rail__group-panel">
              <div className="admin-cp-rail__group-panel-inner">
                <ul className="admin-cp-rail__list">
                  {group.links.map((link) => {
                    const active = isActive(pathname, link.href);
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className={`admin-cp-rail__link${active ? ' admin-cp-rail__link--active' : ''}`}
                          aria-current={active ? 'page' : undefined}
                          onClick={onNavigate}
                        >
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
