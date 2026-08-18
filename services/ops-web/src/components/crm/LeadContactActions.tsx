'use client';

import { ApiError } from '@/lib/api';
import { startLeadB2bCall } from '@/lib/b2b-calls-api';

function phoneTelHref(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : '#';
}

export function LeadContactActions({
  phone,
  onCopy,
  leadId,
  accessToken,
}: {
  phone: string;
  onCopy: (value: string, label: string) => void;
  leadId?: number;
  accessToken?: string | null;
}) {
  if (!phone.trim()) return null;

  async function handleSoftphoneCall(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!leadId || !accessToken) return;
    event.preventDefault();
    try {
      await startLeadB2bCall(accessToken, leadId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        window.location.href = phoneTelHref(phone);
        return;
      }
      window.location.href = phoneTelHref(phone);
    }
  }

  return (
    <div className="lead-contact-actions" data-testid="lead-contact-copy">
      <a
        href={phoneTelHref(phone)}
        className="lead-contact-actions__btn lead-contact-actions__btn--primary"
        data-testid="lead-contact-call"
        onClick={(e) => void handleSoftphoneCall(e)}
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
