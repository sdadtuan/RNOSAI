'use client';

import Link from 'next/link';
import { AM_HELP_LINKS, amHelpTitle } from '@/lib/crm/am-help.util';

type AmHelpDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function AmHelpDrawer({ open, onClose }: AmHelpDrawerProps) {
  if (!open) return null;

  return (
    <div
      className="am-drawer-bg"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <aside className="am-drawer" role="dialog" aria-modal="true" aria-label={amHelpTitle()}>
        <div className="am-drawer__head">
          <strong>{amHelpTitle()}</strong>
          <button type="button" className="am-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        <p className="am-help__body">
          AM giữ khách sau hợp đồng: retain / renew / expand / health.
          <br />
          Sổ mặc định ẩn churned. Health 4 band. Việc CSD chỉ liên kết — không Resolve.
        </p>
        <ul className="am-help__links">
          {AM_HELP_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="am-help__link" onClick={onClose}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
