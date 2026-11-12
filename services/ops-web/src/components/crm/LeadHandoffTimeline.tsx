'use client';

import type { LeadFunnelSnapshot } from '@/lib/api';

type StepState = 'done' | 'current' | 'pending';

type Step = {
  key: string;
  label: string;
  state: StepState;
  detail?: string;
};

export function buildLeadHandoffSteps(funnel: LeadFunnelSnapshot | null): Step[] {
  const presales = funnel?.presales?.presales;
  const handoff = funnel?.presales?.handoff?.status ?? presales?.handoff_status ?? '';
  const solution = funnel?.presales?.solution_case;
  const quote = funnel?.presales?.quote_case;

  const submitted = handoff === 'pending' || handoff === 'with_solution' || handoff === 'released' || Boolean(quote);
  const amClaimed = Boolean(solution && solution.phase !== 'cho_nhan') || handoff === 'with_solution' || handoff === 'released' || Boolean(quote);
  const solutionWorking = amClaimed;
  const returnedOrSubmitted = handoff === 'released' || Boolean(quote);
  const customerOk = Boolean(quote && quote.phase !== 'sale_approve_solution');
  const quoting = customerOk;
  const ceoReview = quote?.phase === 'ceo_review' || quote?.phase === 'sale_review' || quote?.phase === 'hop_dong' || quote?.phase === 'trien_khai';
  const ceoApproved = quote?.phase === 'hop_dong' || quote?.phase === 'trien_khai' || Boolean(quote?.quote_approved_at);

  const steps: Array<{ key: string; label: string; done: boolean; currentWhen: boolean; detail?: string }> = [
    { key: 'submit', label: 'Sales nộp Solutions', done: submitted, currentWhen: !submitted, detail: submitted ? '' : 'Chờ SUBMIT FOR SOLUTION' },
    { key: 'claim', label: 'AM nhận case', done: amClaimed, currentWhen: submitted && !amClaimed, detail: solution?.phase === 'cho_nhan' ? 'Hạn nhận 15 phút (giờ làm việc 8:30–16:00)' : '' },
    { key: 'work', label: 'AM làm Solutions', done: returnedOrSubmitted, currentWhen: solutionWorking && !returnedOrSubmitted, detail: solution?.timer_label && !returnedOrSubmitted ? `${solution.timer_label} (8:30–16:00, trừ cuối tuần)` : '' },
    { key: 'return', label: 'Nộp / trả lại Sales', done: returnedOrSubmitted, currentWhen: false },
    { key: 'agree', label: 'Khách đồng ý', done: customerOk, currentWhen: handoff === 'released' && !customerOk && quote?.phase === 'sale_approve_solution' },
    { key: 'quote', label: 'AM lập báo giá', done: ceoReview, currentWhen: quoting && !ceoReview, detail: quote?.phase === 'bao_gia' ? 'Chờ lập báo giá · 2 giờ làm việc (8:30–16:00)' : '' },
    { key: 'ceo', label: 'CEO duyệt', done: ceoApproved, currentWhen: ceoReview && !ceoApproved, detail: 'Chờ CEO duyệt hoặc từ chối kèm lý do' },
    { key: 'download', label: 'Sales xem và tải', done: ceoApproved, currentWhen: ceoApproved && quote?.phase === 'hop_dong' },
  ];

  return steps.map((step) => ({
    key: step.key,
    label: step.label,
    state: step.done ? 'done' : step.currentWhen ? 'current' : 'pending',
    detail: step.detail || undefined,
  }));
}

export function LeadHandoffTimeline({
  funnel,
}: {
  funnel: LeadFunnelSnapshot | null;
}) {
  const steps = buildLeadHandoffSteps(funnel);
  if (steps.every((step) => step.state === 'pending')) return null;
  const current = steps.find((step) => step.state === 'current');

  return (
    <nav aria-label="Tiến độ bàn giao" className="lead-handoff-timeline" data-testid="lead-handoff-timeline">
      <div className="lead-journey__head">
        <h3 className="lead-journey__title">Tiến độ bàn giao</h3>
        <p className="lead-journey__desc">
          {current?.detail
            ? current.detail
            : 'Sales → AM Solutions → Khách đồng ý → Báo giá → CEO duyệt → Sales tải'}
        </p>
      </div>
      <ol className="lead-journey__track">
        {steps.map((step, idx) => (
          <li key={step.key} className={`lead-journey__step lead-journey__step--${step.state}`}>
            <span className="lead-journey__link lead-journey__link--muted">
              <span className="lead-journey__dot" aria-hidden>
                {step.state === 'done' ? '✓' : idx + 1}
              </span>
              <span className="lead-journey__label">{step.label}</span>
              <span className="lead-journey__label-short" title={step.label}>
                {step.label}
              </span>
            </span>
            {idx < steps.length - 1 ? <span className="lead-journey__line" aria-hidden /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
