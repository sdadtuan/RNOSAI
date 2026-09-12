'use client';

type MsosToastProps = {
  message: string;
  onClose: () => void;
};

export function MsosToast({ message, onClose }: MsosToastProps) {
  if (!message) return null;
  return (
    <div className="msos-toast show" role="status">
      {message}
      <button type="button" className="msos-toast__close" onClick={onClose} aria-label="Đóng">
        ×
      </button>
    </div>
  );
}
