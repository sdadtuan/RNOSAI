'use client';

type Props = {
  open: boolean;
  companyName: string;
  readinessStatus?: string | null;
  bulkCount?: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (checklist: Record<string, boolean>) => void;
};

export function RawLeadAcceptModal({
  open,
  companyName,
  readinessStatus,
  bulkCount,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;
  const items = [
    { key: 'opened_evidence', label: 'Đã mở evidence' },
    { key: 'contact_ok', label: 'SĐT/email hợp lý' },
    { key: 'geo_industry_ok', label: 'Đúng địa bàn/ngành' },
    { key: 'not_existing_client', label: 'Không trùng khách đang phục vụ' },
  ];

  const readiness = String(readinessStatus ?? '').toUpperCase();
  const isBulk = (bulkCount ?? 0) > 1;
  const promoteHint = isBulk
    ? `Accept ${bulkCount} lead đã chọn. NEEDS_REVIEW / unclassified contactable → Sẵn sàng push.`
    : readiness === 'NEEDS_REVIEW' || !readiness
      ? 'Accept sẽ chuyển lead sang tab Sẵn sàng push (READY_TO_PUSH) nếu đủ điều kiện.'
      : readiness === 'MISSING_CONTACT'
        ? 'Lead đang thiếu contact — Accept không tự chuyển READY. Bổ sung SĐT/email trước.'
        : readiness === 'DUPLICATE_OR_BLACKLIST'
          ? 'Lead trùng/blacklist — Accept không tự chuyển READY.'
          : null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: 440 }}>
        <h3 style={{ marginTop: 0 }}>
          {isBulk ? `Accept ${bulkCount} lead thô` : 'Accept lead thô'}
        </h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {isBulk ? 'Checklist áp dụng chung cho mọi lead đã chọn.' : companyName}
        </p>
        {promoteHint ? (
          <p className="rlh-inline-warn" style={{ marginTop: 0 }}>
            {promoteHint}
          </p>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const checklist: Record<string, boolean> = {};
            for (const item of items) checklist[item.key] = fd.get(item.key) === 'on';
            onConfirm(checklist);
          }}
        >
          <div className="rlh-accept-list">
            {items.map((item) => (
              <label key={item.key} className="form-check">
                <input type="checkbox" name={item.key} required />
                {item.label}
              </label>
            ))}
          </div>
          <div className="form-footer">
            <button type="submit" className="btn" disabled={busy}>
              Confirm accept
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
