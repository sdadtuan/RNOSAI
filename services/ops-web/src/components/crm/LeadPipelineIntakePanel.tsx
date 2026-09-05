'use client';

import Link from 'next/link';
import type { IntakeStepSummary } from '@/lib/crm/funnel-stepper.types';

export function LeadPipelineIntakePanel({
  leadId,
  serviceSlug,
  intakeSummary,
}: {
  leadId: number;
  serviceSlug?: string | null;
  intakeSummary?: IntakeStepSummary | null;
}) {
  const slug = String(serviceSlug ?? '').trim();
  const href = `/crm/intake?lead_id=${leadId}${slug ? `&service_slug=${encodeURIComponent(slug)}` : ''}`;

  return (
    <div className="card-inner" id="funnel-intake-bant">
      <h3 style={{ marginTop: 0 }}>Khảo sát BANT</h3>
      {intakeSummary?.has_draft ? (
        <p className="muted">Đang có bản nháp khảo sát.</p>
      ) : null}
      {intakeSummary?.latest_completed ? (
        <p>
          Đã hoàn thành · BANT {intakeSummary.latest_completed.bant_total} ·{' '}
          {intakeSummary.latest_completed.decision}
        </p>
      ) : (
        <p className="muted">Mở trang khảo sát để ghi BANT. Wave 1 không nhúng form tại đây.</p>
      )}
      <Link href={href} className="btn btn-primary">
        Mở khảo sát BANT
      </Link>
    </div>
  );
}
