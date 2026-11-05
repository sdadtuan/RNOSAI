'use client';

export type CeoActionConfirmDialogProps = {
  copy: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CeoActionConfirmDialog({
  copy,
  busy,
  onCancel,
  onConfirm,
}: CeoActionConfirmDialogProps) {
  return (
    <dialog open className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Xác nhận hành động</h3>
        <p className="py-4">{copy}</p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={onCancel}>
            Hủy
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onConfirm}>
            Xác nhận
          </button>
        </div>
      </div>
    </dialog>
  );
}
