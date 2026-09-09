'use client';

type Props = {
  open: boolean;
  sourceId: string;
  onClose: () => void;
};

export function ServiceKpiChangeOrderStub({ open, sourceId, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="kpi-hub-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="kpi-hub-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Change Order"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="kpi-hub-drawer__head">
          <h2>Change Order (stub)</h2>
          <button type="button" className="kpi-hub-drawer__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="kpi-hub-drawer__body">
          <p className="kpi-hub-notice">
            Tạo Change Order từ Quoted snapshot cho source <strong>{sourceId}</strong>. Wave tiếp theo sẽ nối Quote OS
            convert + material variance workflow.
          </p>
          <ul className="kpi-hub-skpi-readiness-list">
            <li>Quoted snapshot → CO draft</li>
            <li>Finance + GDKD approval</li>
            <li>Cập nhật Delivered ledger</li>
          </ul>
        </div>
        <footer className="kpi-hub-drawer__foot">
          <button type="button" className="kpi-hub-btn kpi-hub-btn--ghost" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="kpi-hub-btn kpi-hub-btn--primary" disabled title="Stub — chưa nối Quote OS">
            Tạo Change Order
          </button>
        </footer>
      </aside>
    </div>
  );
}
