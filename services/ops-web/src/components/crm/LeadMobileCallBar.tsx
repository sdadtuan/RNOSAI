'use client';

import { placeB2bSoftphoneCall } from '@/components/crm/B2bSoftphone';
import { phoneTelHref, shouldTelFallbackOnCallError } from '@/lib/lead-contact-call.util';
import { useState } from 'react';

export function LeadMobileCallBar({
  phone,
  leadId,
  accessToken,
  onCopy,
  onCallPlaced,
}: {
  phone: string;
  leadId: number;
  accessToken?: string | null;
  onCopy?: (value: string, label: string) => void;
  onCallPlaced?: (mode: 'webrtc' | 'server' | 'tel') => void;
}) {
  const [callConsent, setCallConsent] = useState(false);

  if (!phone.trim()) return null;

  async function handleSoftphoneCall(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!accessToken) return;
    if (!callConsent) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    try {
      const mode = await placeB2bSoftphoneCall({ accessToken, leadId, phone });
      onCallPlaced?.(mode);
    } catch (err) {
      if (shouldTelFallbackOnCallError(err)) {
        window.location.href = phoneTelHref(phone);
        return;
      }
      window.location.href = phoneTelHref(phone);
    }
  }

  return (
    <div className="lead-b2b-call-sticky" data-testid="lead-b2b-call-sticky">
      <label className="lead-b2b-call-sticky__consent">
        <input
          type="checkbox"
          checked={callConsent}
          onChange={(event) => setCallConsent(event.target.checked)}
        />
        KH đồng ý ghi âm
      </label>
      <div className="lead-b2b-call-sticky__row">
        <a
          href={phoneTelHref(phone)}
          className={`lead-b2b-call-sticky__btn${callConsent ? '' : ' lead-b2b-call-sticky__btn--disabled'}`}
          data-testid="lead-b2b-call-sticky-btn"
          aria-disabled={!callConsent}
          onClick={(e) => void handleSoftphoneCall(e)}
        >
          Gọi ngay
        </a>
        {onCopy ? (
          <button
            type="button"
            className="lead-b2b-call-sticky__secondary"
            aria-label="Copy SĐT"
            onClick={() => onCopy(phone, 'SĐT')}
          >
            SĐT
          </button>
        ) : null}
        {onCopy ? (
          <button
            type="button"
            className="lead-b2b-call-sticky__secondary"
            aria-label="Copy Zalo"
            title="Copy SĐT để dán trên Zalo"
            onClick={() => onCopy(phone, 'Zalo')}
          >
            Zalo
          </button>
        ) : null}
      </div>
    </div>
  );
}
