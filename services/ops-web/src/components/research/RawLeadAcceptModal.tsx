'use client';

type Props = {
  open: boolean;
  companyName: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (checklist: Record<string, boolean>) => void;
};

export function RawLeadAcceptModal({ open, companyName, busy, onCancel, onConfirm }: Props) {
  if (!open) return null;
  const items = [
    { key: 'opened_evidence', label: 'Đã mở evidence' },
    { key: 'contact_ok', label: 'SĐT/email hợp lý' },
    { key: 'geo_industry_ok', label: 'Đúng địa bàn/ngành' },
    { key: 'not_existing_client', label: 'Không trùng khách đang phục vụ' },
  ];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: 420 }}>
        <h3>Accept lead thô</h3>
        <p className="muted">{companyName}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const checklist: Record<string, boolean> = {};
            for (const item of items) checklist[item.key] = fd.get(item.key) === 'on';
            onConfirm(checklist);
          }}
        >
          {items.map((item) => (
            <label key={item.key} style={{ display: 'block', marginBottom: 8 }}>
              <input type="checkbox" name={item.key} required /> {item.label}
            </label>
          ))}
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button type="submit" disabled={busy}>
              Confirm accept
            </button>
            <button type="button" onClick={onCancel} disabled={busy}>
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
