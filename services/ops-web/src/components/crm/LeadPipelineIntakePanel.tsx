'use client';

import Link from 'next/link';
import { BANT_KEYS, type BantKey } from '@/lib/crm/intake-bant';
import { BANT_FIELD_LABELS } from '@/lib/crm/intake-labels';
import type { IntakeStepSummary } from '@/lib/crm/funnel-stepper.types';

const DECISION_LABEL: Record<string, string> = {
  go: 'Go',
  nurture: 'Nurture',
  no_go: 'No-Go',
};

function shortLabel(key: BantKey): string {
  return BANT_FIELD_LABELS[key].label.split(' "')[0];
}

export function bantDetailHref(
  leadId: number,
  sessionId?: number,
  serviceSlug?: string | null,
): string {
  const qs = new URLSearchParams();
  if (leadId > 0) qs.set('lead_id', String(leadId));
  if (sessionId && sessionId > 0) qs.set('session_id', String(sessionId));
  const slug = String(serviceSlug ?? '').trim();
  if (slug) qs.set('service_slug', slug);
  qs.set('open', 'bant');
  return `/crm/intake?${qs.toString()}`;
}

export function LeadPipelineIntakePanel({
  leadId = 0,
  serviceSlug,
  intakeSummary,
  loading = false,
  pastBant = false,
}: {
  leadId?: number;
  serviceSlug?: string | null;
  intakeSummary?: IntakeStepSummary | null;
  token?: string;
  readOnly?: boolean;
  onSaved?: () => void;
  editRequest?: number;
  loading?: boolean;
  /** Lead already passed BANT (handed off / quote) — do not show the empty "create session" CTA. */
  pastBant?: boolean;
}) {
  const preview = intakeSummary?.preview;
  const completed = intakeSummary?.latest_completed;

  if (!preview && !completed) {
    if (loading || pastBant) return null;
    return (
      <div className="card-inner" id="funnel-intake-bant">
        <p className="muted" style={{ margin: 0 }}>
          Chưa có phiên BANT. Tạo phiên để chấm điểm rồi giao Solution.
        </p>
      </div>
    );
  }

  const viewScores = preview?.bant ?? {};
  const viewTotal = preview?.bant_total ?? completed?.bant_total ?? 0;
  const viewDecision = preview?.decision || completed?.decision || '';
  const draft = preview?.status === 'draft' || Boolean(intakeSummary?.has_draft);
  const sessionId = preview?.id ?? completed?.id ?? 0;
  const href = bantDetailHref(leadId, sessionId, serviceSlug);

  return (
    <Link href={href} className="lead-bant-summary" id="funnel-intake-bant">
      <div className="lead-bant-summary__head">
        <strong>BANT {viewTotal}/30</strong>
        <span>{DECISION_LABEL[viewDecision] || (viewDecision ? viewDecision : 'Chưa chốt')}</span>
        {draft ? <span className="muted">Nháp</span> : <span className="muted">Đã chốt</span>}
        <span className="lead-bant-summary__hint">Mở chi tiết</span>
      </div>
      <dl className="lead-bant-summary__grid">
        {BANT_KEYS.map((key) => (
          <div key={key}>
            <dt>{shortLabel(key)}</dt>
            <dd>{Number(viewScores[key] ?? 0)}/5</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}
