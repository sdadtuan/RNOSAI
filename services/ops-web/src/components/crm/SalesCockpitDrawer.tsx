'use client';

import { useEffect, type ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  kicker?: string;
  title?: string;
  testId?: string;
};

export function SalesCockpitDrawer({
  open,
  onClose,
  children,
  kicker = 'SCI',
  title = 'Sales Cockpit',
  testId = 'lead-cockpit-drawer',
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="lead-cockpit-backdrop"
        role="presentation"
        data-testid="lead-cockpit-backdrop"
        onClick={onClose}
      />
      <aside
        className="lead-cockpit-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
      >
        <header className="lead-cockpit-drawer__head">
          <div>
            <p className="lead-cockpit-drawer__kicker">{kicker}</p>
            <h2 className="lead-cockpit-drawer__title">{title}</h2>
          </div>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </header>
        <div className="lead-cockpit-drawer__body">{children}</div>
      </aside>
    </>
  );
}
