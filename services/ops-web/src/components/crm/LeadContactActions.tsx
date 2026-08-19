'use client';

import { placeB2bSoftphoneCall } from '@/components/crm/B2bSoftphone';
import { phoneTelHref, shouldTelFallbackOnCallError } from '@/lib/lead-contact-call.util';

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
      await placeB2bSoftphoneCall({ accessToken, leadId, phone });
    } catch (err) {
      if (shouldTelFallbackOnCallError(err)) {
        window.location.href = phoneTelHref(phone);
        return;
      }
      window.location.href = phoneTelHref(phone);
    }
  }

  return (
    <div className="lead-contact-actions" id="lead-contact-actions" data-testid="lead-contact-copy">
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
