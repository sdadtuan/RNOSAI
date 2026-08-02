'use client';

function phoneTelHref(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : '#';
}

export function LeadContactActions({
  phone,
  onCopy,
}: {
  phone: string;
  onCopy: (value: string, label: string) => void;
}) {
  if (!phone.trim()) return null;

  return (
    <div className="lead-contact-actions" data-testid="lead-contact-copy">
      <a
        href={phoneTelHref(phone)}
        className="lead-contact-actions__btn lead-contact-actions__btn--primary"
        data-testid="lead-contact-call"
      >
        Gọi ngay
      </a>
      <button type="button" className="lead-contact-actions__btn" onClick={() => onCopy(phone, 'SĐT')}>
        Copy SĐT
      </button>
      <button
        type="button"
        className="lead-contact-actions__btn"
        onClick={() => onCopy(phone, 'Zalo')}
        title="Copy SĐT để dán trên Zalo"
      >
        Copy Zalo
      </button>
    </div>
  );
}
