'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchLeadMeetingPrep } from '@/lib/lead-meeting-prep-api';
import { prepStageSubtitle } from '@/lib/lmp-stage-labels';
import { leadMeetingPrepEnabled } from '@/lib/crm/lmp-flags';

type Props = {
  token: string;
  leadId: number;
};

export function IntakePrepSummaryCard({ token, leadId }: Props) {
  const [summary, setSummary] = useState<string>('');
  const [stage, setStage] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (!leadMeetingPrepEnabled() || !token || leadId <= 0) return;
    void (async () => {
      try {
        const prep = await fetchLeadMeetingPrep(token, leadId);
        setStatus(prep.status);
        setStage(prep.prep_stage);
        const text = prep.result?.company_profile?.summary?.trim();
        setSummary(text ?? '');
      } catch {
        setSummary('');
      }
    })();
  }, [token, leadId]);

  if (!leadMeetingPrepEnabled()) return null;

  return (
    <section className="intake-prep-card deal-room-panel">
      <header className="deal-room-panel__head">
        <h2 className="deal-room-panel__title">Tóm tắt prep (SCI)</h2>
        <Link href={`/crm/leads/${leadId}?prep=1`} className="btn btn-sm btn-secondary">
          Sales Cockpit
        </Link>
      </header>
      {status === 'ready' && summary ? (
        <>
          <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
            {prepStageSubtitle(stage)}
          </p>
          <p>{summary.slice(0, 320)}{summary.length > 320 ? '…' : ''}</p>
        </>
      ) : (
        <p className="muted">
          {status === 'running' || status === 'pending'
            ? 'Prep đang chạy — xem Sales Cockpit để theo dõi.'
            : 'Chưa có prep sẵn sàng — xem Sales Cockpit trên lead detail.'}
        </p>
      )}
    </section>
  );
}
