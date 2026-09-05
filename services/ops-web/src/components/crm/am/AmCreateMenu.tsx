'use client';

import { useEffect, useRef, useState } from 'react';

type CreateKind = 'client' | 'task' | 'plan';

type AmCreateMenuProps = {
  canEdit: boolean;
};

export function AmCreateMenu({ canEdit }: AmCreateMenuProps) {
  const [open, setOpen] = useState(false);
  const [stub, setStub] = useState<CreateKind | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function openStub(kind: CreateKind) {
    if (!canEdit) return;
    setOpen(false);
    setStub(kind);
  }

  const stubTitle =
    stub === 'client' ? 'Tạo khách' : stub === 'task' ? 'Tạo việc' : stub === 'plan' ? 'Tạo Renewal/Plan' : '';

  return (
    <div className="am-create" ref={wrapRef}>
      <button
        type="button"
        className="am-btn am-btn--primary"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={!canEdit}
        title={canEdit ? 'Tạo mới' : 'Cần quyền crm_am.edit'}
        onClick={() => canEdit && setOpen((v) => !v)}
      >
        + Tạo mới ▾
      </button>
      {open ? (
        <div className="am-create__menu" role="menu">
          <button type="button" role="menuitem" onClick={() => openStub('client')}>
            Khách
          </button>
          <button type="button" role="menuitem" onClick={() => openStub('task')}>
            Việc
          </button>
          <button type="button" role="menuitem" onClick={() => openStub('plan')}>
            Renewal/Plan
          </button>
          <button type="button" role="menuitem" disabled title="Mở ở Wave 4">
            Cơ hội
          </button>
          <button type="button" role="menuitem" disabled title="Mở ở Wave 3">
            Log tương tác
          </button>
        </div>
      ) : null}
      {stub ? (
        <div className="am-drawer-bg" role="presentation">
          <div className="am-drawer" role="dialog" aria-label={stubTitle}>
            <div className="am-drawer__head">
              <strong>{stubTitle}</strong>
              <button type="button" className="am-btn" onClick={() => setStub(null)}>
                Đóng
              </button>
            </div>
            <p className="am-muted">Drawer tạo mới mở ở Task 6–7.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
