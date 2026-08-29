export type JourneyState = 'done' | 'current' | 'pending' | 'blocked';

export type SalesJourneyKey = 'b2' | 'presales' | 'intake' | 'consult' | 'proposal' | 'contract';
export type DeliveryJourneyKey = 'onboard' | 'deliver' | 'agency' | 'retain';
export type LeadJourneyStepKey = SalesJourneyKey | DeliveryJourneyKey;

export type LeadJourneyStep = {
  key: LeadJourneyStepKey;
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
  lifecycleStage?: string | null;
  agencyClientId?: string | null;
  leadId?: number;
  serviceSlug?: string | null;
};

const SALES_KEYS: SalesJourneyKey[] = [
  'b2',
  'presales',
  'intake',
  'consult',
  'proposal',
  'contract',
];

const DELIVERY_KEYS: DeliveryJourneyKey[] = ['onboard', 'deliver', 'agency', 'retain'];

const DELIVERY_ORDER = ['onboard', 'deliver', 'handover', 'retain'] as const;

const SALES_LABELS: Record<SalesJourneyKey, { label_vi: string; short_vi: string }> = {
  b2: { label_vi: 'B2 Liên hệ', short_vi: 'B2' },
  presales: { label_vi: 'Pre-sales', short_vi: 'Pre' },
  intake: { label_vi: 'Intake BANT', short_vi: 'Intake' },
  consult: { label_vi: 'Tư vấn', short_vi: 'TV' },
  proposal: { label_vi: 'Báo giá', short_vi: 'BG' },
  contract: { label_vi: 'HĐ / Agency', short_vi: 'HĐ' },
};

const DELIVERY_LABELS: Record<DeliveryJourneyKey, { label_vi: string; short_vi: string }> = {
  onboard: { label_vi: 'Onboard', short_vi: 'OB' },
  deliver: { label_vi: 'Triển khai', short_vi: 'Giao' },
  agency: { label_vi: 'Agency Client', short_vi: 'CL' },
  retain: { label_vi: 'Giữ chân', short_vi: 'Ret' },
};

export function deliveryStepIndex(stage: string | null | undefined): number {
  const s = (stage ?? '').trim().toLowerCase();
  const idx = DELIVERY_ORDER.indexOf(s as (typeof DELIVERY_ORDER)[number]);
  return idx >= 0 ? idx : 0;
}

export function showDeliverySpine(input: LeadJourneyInput): boolean {
  return Boolean(input.contractActive && input.lifecycleId != null) && !input.reviewActive;
}

function resolveSalesSteps(input: LeadJourneyInput): LeadJourneyStep[] {
  const postWon = showDeliverySpine(input);

  if (input.reviewActive) {
    return SALES_KEYS.map((key) => ({ key, ...SALES_LABELS[key], state: 'blocked' as const }));
  }

  const stage = (input.presalesStage ?? '').trim().toLowerCase();
  const started = Boolean(stage);
  const order = ['lead', 'consult', 'proposal'];
  const idx = order.indexOf(stage);

  const state: Record<SalesJourneyKey, JourneyState> = postWon
    ? {
        b2: 'done',
        presales: 'done',
        intake: 'done',
        consult: 'done',
        proposal: 'done',
        contract: 'done',
      }
    : {
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
          input.contractActive && input.lifecycleId != null
            ? 'done'
            : stage === 'proposal' && input.hasContract
              ? 'current'
              : 'pending',
      };

  const leadId = input.leadId;
  const slug = input.serviceSlug?.trim();
  const intakeHref =
    leadId != null
      ? `/crm/intake?lead_id=${leadId}${slug ? `&service_slug=${encodeURIComponent(slug)}` : ''}`
      : undefined;

  return SALES_KEYS.map((key) => ({
    key,
    ...SALES_LABELS[key],
    state: state[key],
    anchor:
      key === 'b2'
        ? '#funnel-b2'
        : key === 'presales'
          ? '#funnel-presales'
          : key === 'contract'
            ? '#lead-contract'
            : undefined,
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

function resolveDeliverySteps(input: LeadJourneyInput): LeadJourneyStep[] {
  const lifecycleId = input.lifecycleId!;
  const curIdx = deliveryStepIndex(input.lifecycleStage);
  const agencyId = input.agencyClientId?.trim();

  return DELIVERY_KEYS.map((key, i) => {
    const state: JourneyState =
      i < curIdx ? 'done' : i === curIdx ? 'current' : 'pending';
    const deliveryHref = `/crm/service-delivery/${lifecycleId}`;
    const href =
      key === 'agency'
        ? agencyId
          ? `/agency/clients/${encodeURIComponent(agencyId)}`
          : undefined
        : deliveryHref;

    return {
      key,
      ...DELIVERY_LABELS[key],
      state,
      href,
    };
  });
}

export function resolveLeadJourney(input: LeadJourneyInput): LeadJourneyStep[] {
  const sales = resolveSalesSteps(input);
  if (!showDeliverySpine(input)) {
    return sales;
  }
  return [...sales, ...resolveDeliverySteps(input)];
}
