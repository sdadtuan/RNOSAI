'use client';

import { ApiError } from '@/lib/api';
import { startLeadB2bCall } from '@/lib/b2b-calls-api';

function phoneTelHref(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : '#';
}

export function LeadMobileCallBar({
  phone,
  leadId,
  accessToken,
  onCopy,
}: {
  phone: string;
  leadId: number;
  accessToken?: string | null;
  onCopy?: (value: string, label: string) => void;
}) {
  if (!phone.trim()) return null;

  async function handleSoftphoneCall(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!accessToken) return;
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
    <div className="lead-b2b-call-sticky" data-testid="lead-b2b-call-sticky">
      <a
        href={phoneTelHref(phone)}
        className="lead-b2b-call-sticky__btn"
        data-testid="lead-b2b-call-sticky-btn"
        onClick={(e) => void handleSoftphoneCall(e)}
      >
        Gọi ngay
      </a>
      {onCopy ? (
        <button
          type="button"
          className="lead-b2b-call-sticky__secondary"
          onClick={() => onCopy(phone, 'SĐT')}
        >
          Copy SĐT
        </button>
      ) : null}
    </div>
  );
}
