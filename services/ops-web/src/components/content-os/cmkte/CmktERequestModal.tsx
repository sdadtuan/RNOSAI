'use client';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CmktERequestModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="cmkte-modalback" role="presentation" onClick={onClose}>
      <div
        className="cmkte-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmkte-request-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="cmkte-request-modal-title">Tạo Content Request</h2>
        <p className="cmkte-desc">Form intake sẽ có ở bước sau. Đóng để quay lại Command Center.</p>
        <div className="cmkte-actions cmkte-actions--end">
          <button type="button" className="cmkte-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
