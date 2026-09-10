'use client';

import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function PmModal({ open, title, onClose, children, footer }: Props) {
  if (!open) return null;
  return (
    <div className="kpi-hub-pm-modal-bg" role="presentation" onClick={onClose} onKeyDown={() => undefined}>
      <div
        className="kpi-hub-pm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="kpi-hub-pm-modal__head">
          <h2 id="pm-modal-title">{title}</h2>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="kpi-hub-pm-modal__body">{children}</div>
        {footer ? <footer className="kpi-hub-pm-modal__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
