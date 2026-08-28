export type JourneyState = 'done' | 'current' | 'pending' | 'blocked';

export type LeadJourneyStep = {
  key: 'b2' | 'presales' | 'intake' | 'consult' | 'proposal' | 'contract';
  label_vi: string;
  short_vi: string;
  state: JourneyState;
  href?: string;
  anchor?: string;
};

export type LeadJourneyInput = {
  reviewActive: boolean;
  b2Complete: boolean;
  presalesStage: string | null;
  hasContract: boolean;
  contractActive: boolean;
  lifecycleId: number | null;
  leadId?: number;
  serviceSlug?: string | null;
};

const LABELS: Record<LeadJourneyStep['key'], { label_vi: string; short_vi: string }> = {
  b2: { label_vi: 'B2 Liên hệ', short_vi: 'B2' },
  presales: { label_vi: 'Pre-sales', short_vi: 'Pre' },
  intake: { label_vi: 'Intake BANT', short_vi: 'Intake' },
  consult: { label_vi: 'Tư vấn', short_vi: 'TV' },
  proposal: { label_vi: 'Báo giá', short_vi: 'BG' },
  contract: { label_vi: 'HĐ / Agency', short_vi: 'HĐ' },
};

export function resolveLeadJourney(input: LeadJourneyInput): LeadJourneyStep[] {
  const keys: LeadJourneyStep['key'][] = [
    'b2',
    'presales',
    'intake',
    'consult',
    'proposal',
    'contract',
  ];
  if (input.reviewActive) {
    return keys.map((key) => ({ key, ...LABELS[key], state: 'blocked' as const }));
  }

  const stage = (input.presalesStage ?? '').trim().toLowerCase();
  const started = Boolean(stage);
  const order = ['lead', 'consult', 'proposal'];
  const idx = order.indexOf(stage);

  const state: Record<LeadJourneyStep['key'], JourneyState> = {
    b2: input.b2Complete ? 'done' : 'current',
    presales: !input.b2Complete ? 'pending' : !started ? 'current' : idx >= 0 ? 'done' : 'pending',
    intake: !input.b2Complete
      ? 'pending'
      : !started || stage === 'lead'
        ? 'current'
        : 'done',
    consult: stage === 'consult' ? 'current' : idx >= 1 ? 'done' : 'pending',
    proposal: stage === 'proposal' ? 'current' : idx >= 2 ? 'done' : 'pending',
    contract:
      stage === 'proposal'
        ? input.contractActive
          ? 'done'
          : input.hasContract
            ? 'current'
            : 'current'
        : 'pending',
  };

  const leadId = input.leadId;
  const slug = input.serviceSlug?.trim();
  const intakeHref =
    leadId != null
      ? `/crm/intake?lead_id=${leadId}${slug ? `&service_slug=${encodeURIComponent(slug)}` : ''}`
      : undefined;

  return keys.map((key) => ({
    key,
    ...LABELS[key],
    state: state[key],
    anchor:
      key === 'b2' ? '#funnel-b2' : key === 'presales' ? '#funnel-presales' : key === 'contract' ? '#lead-contract' : undefined,
    href:
      key === 'intake'
        ? intakeHref
        : key === 'consult'
          ? undefined
          : key === 'proposal'
            ? leadId != null
              ? `/crm/leads/${leadId}/deal-room`
              : undefined
            : key === 'contract' && input.lifecycleId
              ? `/crm/service-delivery/${input.lifecycleId}`
              : undefined,
  }));
}
