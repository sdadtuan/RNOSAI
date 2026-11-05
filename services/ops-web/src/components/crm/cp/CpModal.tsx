'use client';

import type { ReactNode } from 'react';

type CpModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
};

export function CpModal({ open, title, onClose, children, actions }: CpModalProps) {
  if (!open) return null;
  return (
    <div className="cp-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cp-modal__head">
          <h2 id="cp-modal-title">{title}</h2>
          <button type="button" className="cp-btn" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </header>
        <div className="cp-modal__body">{children}</div>
        {actions ? <footer className="cp-modal__foot">{actions}</footer> : null}
      </div>
    </div>
  );
}
