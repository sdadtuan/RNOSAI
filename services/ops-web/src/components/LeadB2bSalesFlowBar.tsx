'use client';

import Link from 'next/link';
import type { LeadFunnelSnapshot } from '@/lib/api';

export interface LeadContractFlowSummary {
  hasContract: boolean;
  contractStatus: string | null;
  pendingApproval: boolean;
  lifecycleId: number | null;
}

interface Props {
  leadId: number;
  funnel: LeadFunnelSnapshot | null;
  contract?: LeadContractFlowSummary | null;
}

type StepState = 'done' | 'current' | 'pending' | 'blocked';

function presalesStageIndex(stage: string | undefined): number {
  const order = ['lead', 'consult', 'proposal'];
  const idx = order.indexOf(stage ?? '');
  return idx >= 0 ? idx : -1;
}

function resolveStepStates(
  funnel: LeadFunnelSnapshot | null,
  contract: LeadContractFlowSummary | null | undefined,
): Record<string, StepState> {
  const inReview = Boolean(funnel?.review_queue.active);
  const b2Done = Boolean(funnel?.care_pipeline.all_complete);
  const presales = funnel?.presales?.presales;
  const presalesStarted = Boolean(presales);
  const presalesStage = presales?.stage;
  const presalesIdx = presalesStageIndex(presalesStage);
  const contractActive = contract?.contractStatus === 'active';
  const hasLifecycle = Boolean(contract?.lifecycleId);

  if (inReview) {
    return {
      b2: 'blocked',
      presales: 'blocked',
      intake: 'blocked',
      contract: 'blocked',
      delivery: 'blocked',
      agency: 'blocked',
    };
  }

  return {
    b2: b2Done ? 'done' : 'current',
    presales: !b2Done
      ? 'pending'
      : !presalesStarted
        ? 'current'
        : presalesIdx >= 2
          ? 'done'
          : presalesIdx >= 0
            ? 'current'
            : 'pending',
    intake: !presalesStarted || presalesIdx < 0
      ? 'pending'
      : presalesIdx >= 1
        ? 'done'
        : 'current',
    contract: presalesIdx >= 2
      ? contractActive
        ? 'done'
        : contract?.hasContract || contract?.pendingApproval
          ? 'current'
          : 'current'
      : 'pending',
    delivery: contractActive
      ? hasLifecycle
        ? 'done'
        : 'current'
      : 'pending',
    agency: contractActive && hasLifecycle ? 'current' : 'pending',
  };
}

const STEP_STYLE: Record<StepState, { bg: string; color: string; border: string }> = {
  done: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  current: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  pending: { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
  blocked: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
};

export function LeadB2bSalesFlowBar({ leadId, funnel, contract }: Props) {
  const states = resolveStepStates(funnel, contract);
  const serviceSlug = funnel?.presales?.presales.service_slug?.trim();
  const intakeHref = `/crm/intake?lead_id=${leadId}${
    serviceSlug ? `&service_slug=${encodeURIComponent(serviceSlug)}` : ''
  }`;
  const lifecycleId = contract?.lifecycleId ?? null;

  const steps: Array<{
    key: string;
    label: string;
    href?: string;
    anchor?: string;
  }> = [
    { key: 'b2', label: 'B2 Liên hệ', anchor: '#funnel-b2' },
    { key: 'presales', label: 'Pre-sales', anchor: '#funnel-presales' },
    { key: 'intake', label: 'Intake BANT', href: intakeHref },
    { key: 'contract', label: 'HĐ dịch vụ', anchor: '#lead-contract' },
    {
      key: 'delivery',
      label: 'Triển khai',
      href: lifecycleId ? `/crm/service-delivery/${lifecycleId}` : '/crm/service-delivery',
    },
    { key: 'agency', label: 'Agency Client', href: '/agency/clients/new' },
  ];

  return (
    <nav
      aria-label="Luồng B2B sales"
      className="lead-b2b-flow-bar"
      style={{
        margin: '0 0 1rem',
        padding: '0.75rem',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--bg-subtle, rgba(255,255,255,0.02))',
      }}
    >
      <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.82rem' }}>
        Luồng B2B: chăm sóc → pre-sales → intake → HĐ → triển khai → agency client
      </p>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {steps.map((step, idx) => {
          const state = states[step.key] ?? 'pending';
          const style = STEP_STYLE[state];
          const content = (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.28rem 0.55rem',
                borderRadius: 999,
                fontSize: '0.78rem',
                fontWeight: state === 'current' ? 600 : 500,
                background: style.bg,
                color: style.color,
                border: `1px solid ${style.border}`,
              }}
            >
              <span aria-hidden>{state === 'done' ? '✓' : state === 'blocked' ? '!' : idx + 1}</span>
              {step.label}
            </span>
          );

          return (
            <span key={step.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              {step.href ? (
                <Link href={step.href} className="nav-link" style={{ textDecoration: 'none' }}>
                  {content}
                </Link>
              ) : step.anchor ? (
                <a href={step.anchor} className="nav-link" style={{ textDecoration: 'none' }}>
                  {content}
                </a>
              ) : (
                content
              )}
              {idx < steps.length - 1 ? (
                <span className="muted" aria-hidden style={{ fontSize: '0.75rem' }}>
                  →
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      {funnel?.review_queue.active ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#991b1b' }}>
          Lead đang <strong>Phải tra soát</strong>
          {funnel.review_queue.hours_waiting != null
            ? ` (${funnel.review_queue.hours_waiting}h)`
            : ''}
          . AM tạm khóa thao tác funnel — GDKD xử lý tại{' '}
          <Link href="/crm/leads/review-queue" className="nav-link">
            inbox Phải tra soát
          </Link>
          .
        </p>
      ) : null}
    </nav>
  );
}
