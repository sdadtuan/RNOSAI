'use client';

import { useEffect, type ReactNode } from 'react';

export function RevOpsModalFrame({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="revops-modal"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className={`revops-modal__box${wide ? ' revops-modal__box--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="revops-modal-title"
      >
        <header className="revops-modal__head">
          <h2 id="revops-modal-title">{title}</h2>
          <button type="button" className="revops-btn revops-btn--ghost" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="revops-modal__body">{children}</div>
        {footer ? <footer className="revops-modal__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
