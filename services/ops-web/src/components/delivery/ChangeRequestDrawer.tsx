'use client';

import { useState } from 'react';
import type { DeliveryChangeRequestRow } from '@/lib/delivery-projects-api';

type ChangeRequestDrawerProps = {
  open: boolean;
  projectLabel: string;
  items: DeliveryChangeRequestRow[];
  onClose: () => void;
  onCreate?: (body: { kind: 'scope' | 'budget'; note?: string; submit?: boolean }) => void;
};

export function ChangeRequestDrawer({ open, projectLabel, items, onClose, onCreate }: ChangeRequestDrawerProps) {
  const [kind, setKind] = useState<'scope' | 'budget'>('scope');
  const [note, setNote] = useState('');

  if (!open) return null;

  return (
    <div className="delivery-cr-drawer" data-testid="delivery-cr-drawer">
      <div className="delivery-cr-drawer__backdrop" onClick={onClose} aria-hidden />
      <aside className="delivery-cr-drawer__panel">
        <header className="delivery-cr-drawer__head">
          <h3>Change Request</h3>
          <p>{projectLabel}</p>
          <button type="button" className="delivery-btn delivery-btn--ghost" onClick={onClose}>
            Đóng
          </button>
        </header>
        {onCreate ? (
          <div className="delivery-cr-drawer__form">
            <label>
              Loại
              <select value={kind} onChange={(e) => setKind(e.target.value as 'scope' | 'budget')}>
                <option value="scope">Scope</option>
                <option value="budget">Budget</option>
              </select>
            </label>
            <label>
              Ghi chú
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </label>
            <div className="delivery-cr-drawer__actions">
              <button type="button" className="delivery-btn delivery-btn--ghost" onClick={() => onCreate({ kind, note })}>
                Lưu nháp
              </button>
              <button
                type="button"
                className="delivery-btn delivery-btn--primary"
                onClick={() => onCreate({ kind, note, submit: true })}
              >
                Gửi duyệt
              </button>
            </div>
          </div>
        ) : null}
        <ul className="delivery-cr-list">
          {items.length === 0 ? <li className="delivery-empty-hint">Chưa có CR.</li> : null}
          {items.map((cr) => (
            <li key={cr.id}>
              <strong>{cr.kind}</strong> · {cr.status}
              {cr.note ? <span> — {cr.note}</span> : null}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
