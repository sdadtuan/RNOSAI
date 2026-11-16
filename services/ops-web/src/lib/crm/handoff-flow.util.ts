/**
 * Single source of truth for the Sales Discovery → Solutions → Quote → Contract
 * handoff flow. UI steppers (AM desk, "Tiến độ bàn giao", Pipeline), Kanban
 * columns, status badges, and notifications should all derive from these steps.
 *
 * Stored codes stay backward-compatible:
 *   handoff pending      → Chờ Solutions
 *   handoff with_solution → AM làm Solution
 *   handoff released / lead status bao_gia → Chờ báo giá
 *   dam_phan             → Chờ CEO duyệt
 *   won / chot / contract → Ký hợp đồng
 *   trien_khai            → Triển Khai
 *   dang_tu_van (no handoff or returned) → Sales tư vấn & nhập Brief
 *   moi                  → Tiếp nhận Lead (until first contact / B2 is done)
 *   da_lien_he / firstContactDone → Sales tư vấn & nhập Brief
 */
export const HANDOFF_FLOW_STEP_KEYS = [
  'receive_lead',
  'sales_brief',
  'await_solutions',
  'doing_solutions',
  'await_quote',
  'negotiate',
  'sign_contract',
  'trien_khai',
] as const;

export type HandoffFlowStepKey = (typeof HANDOFF_FLOW_STEP_KEYS)[number];

export type HandoffFlowStepState = 'done' | 'current' | 'pending';

export interface HandoffFlowStepDef {
  key: HandoffFlowStepKey;
  index: number;
  label: string;
  shortLabel: string;
  hint: string;
  roleHint: string;
}

export const HANDOFF_FLOW_STEPS: readonly HandoffFlowStepDef[] = [
  {
    key: 'receive_lead',
    index: 1,
    label: 'Tiếp nhận Lead',
    shortLabel: 'Tiếp nhận',
    hint: '',
    roleHint: '',
  },
  {
    key: 'sales_brief',
    index: 2,
    label: 'Sales tư vấn & nhập Brief',
    shortLabel: 'Sales Brief',
    hint: 'Pre Sale · Sales Discovery',
    roleHint: 'Sales',
  },
  {
    key: 'await_solutions',
    index: 3,
    label: 'Chờ Solutions',
    shortLabel: 'Chờ Solutions',
    hint: 'AM làm Solution',
    roleHint: 'Account Manager',
  },
  {
    key: 'doing_solutions',
    index: 4,
    label: 'AM làm Solution',
    shortLabel: 'AM làm',
    hint: 'Account Manager',
    roleHint: 'Account Manager',
  },
  {
    key: 'await_quote',
    index: 5,
    label: 'Chờ báo giá',
    shortLabel: 'Báo giá',
    hint: 'Account Manager',
    roleHint: 'Account Manager',
  },
  {
    key: 'negotiate',
    index: 6,
    label: 'Chờ CEO duyệt',
    shortLabel: 'Chờ CEO duyệt',
    hint: '',
    roleHint: 'Sales',
  },
  {
    key: 'sign_contract',
    index: 7,
    label: 'Ký hợp đồng',
    shortLabel: 'Ký HĐ',
    hint: '',
    roleHint: '',
  },
  {
    key: 'trien_khai',
    index: 8,
    label: 'Triển Khai',
    shortLabel: 'Triển Khai',
    hint: '',
    roleHint: '',
  },
];

export const HANDOFF_FLOW_STATUS_LABELS: Record<HandoffFlowStepKey, string> = {
  receive_lead: 'Tiếp nhận Lead',
  sales_brief: 'Sales tư vấn & nhập Brief',
  await_solutions: 'Chờ Solutions',
  doing_solutions: 'AM làm Solution',
  await_quote: 'Chờ báo giá',
  negotiate: 'Chờ CEO duyệt',
  sign_contract: 'Ký hợp đồng',
  trien_khai: 'Triển Khai',
};

/** Stored CRM status written when Solution is released to Sales (Chờ báo giá). */
export const SOLUTION_RELEASE_LEAD_STATUS = 'bao_gia';

/** Statuses that may be promoted to Chờ báo giá on Solution release. */
export const STATUSES_PROMOTED_ON_SOLUTION_RELEASE = [
  'moi',
  'new',
  'intake',
  'first_contact',
  'da_lien_he',
  'contacted',
  'qualified',
  'qualify',
  'dang_tu_van',
  'nurturing',
  'hen_gap',
  'consult',
] as const;

export function leadStatusAfterSolutionRelease(
  current: string | null | undefined,
): string | null {
  const status = String(current ?? '')
    .trim()
    .toLowerCase();
  if (!status) return SOLUTION_RELEASE_LEAD_STATUS;
  if ((STATUSES_PROMOTED_ON_SOLUTION_RELEASE as readonly string[]).includes(status)) {
    return SOLUTION_RELEASE_LEAD_STATUS;
  }
  return null;
}

export interface HandoffFlowInput {
  leadStatus?: string | null;
  leadCreatedAt?: string | null;
  leadReceivedAt?: string | null;
  /** presales.handoff.status */
  handoffStatus?: string | null;
  handedOffAt?: string | null;
  /** solution claimed / with_solution start */
  solutionClaimedAt?: string | null;
  solutionReleasedAt?: string | null;
  /** quote_case.phase */
  quotePhase?: string | null;
  hasContract?: boolean;
  contractStatus?: string | null;
  /** Discovery / intake session completed (Submit to AM). */
  discoverySubmitted?: boolean;
  discoverySubmittedAt?: string | null;
  /** Return-to-sales (missing info). */
  returnedToSales?: boolean;
  /**
   * First contact (B2) is done — `funnelB2Complete` / care_pipeline.all_complete.
   * This is the same condition that opens the Discovery / Brief form
   * (`resolveActiveStep` → intake_bant), even if lead status is still `moi`.
   */
  firstContactDone?: boolean;
  quoteSentAt?: string | null;
  quoteApprovedAt?: string | null;
  customerAgreedAt?: string | null;
  contractCreatedAt?: string | null;
  contractSignedAt?: string | null;
}

export interface HandoffFlowStepView extends HandoffFlowStepDef {
  state: HandoffFlowStepState;
  isActive: boolean;
  at: string | null;
}

export interface HandoffFlowView {
  currentKey: HandoffFlowStepKey;
  currentLabel: string;
  steps: HandoffFlowStepView[];
  returnedToSales: boolean;
}

/**
 * New AM-made-Solution path hides the leftover Marketing step
 * ("AM làm Solution" / doing_solutions) so the stepper shows 7 steps.
 * Legacy leads already on doing_solutions still see that step.
 */
export function visibleHandoffFlowSteps(view: HandoffFlowView): HandoffFlowView {
  if (view.currentKey === 'doing_solutions') return view;
  const steps = view.steps
    .filter((step) => step.key !== 'doing_solutions')
    .map((step, index) => ({ ...step, index: index + 1 }));
  return { ...view, steps };
}

function norm(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function firstIso(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const raw = String(value ?? '').trim();
    if (!raw) continue;
    const ms = Date.parse(raw);
    if (!Number.isNaN(ms)) return raw;
  }
  return null;
}

/**
 * Derive the current step key from stored lead + funnel fields.
 * Does not invent data; later stages win over earlier ones.
 */
export function resolveHandoffFlowStep(input: HandoffFlowInput): HandoffFlowStepKey {
  const status = norm(input.leadStatus);
  const handoff = norm(input.handoffStatus);
  const quote = norm(input.quotePhase);
  const contractStatus = norm(input.contractStatus);
  if (status === 'trien_khai' || quote === 'trien_khai') return 'trien_khai';
  if (status === 'won' || status === 'chot' || status === 'post_sale') return 'sign_contract';
  if (Boolean(input.hasContract) && (contractStatus === 'signed' || contractStatus === 'active')) {
    return 'sign_contract';
  }

  // CEO approval flips quote phase to hop_dong. That is step 6 Ký hợp đồng.
  // Leftover lead status dam_phan must not keep the stepper on Chờ CEO duyệt.
  if (
    quote === 'hop_dong' ||
    Boolean(input.contractCreatedAt) ||
    contractStatus === 'draft' ||
    contractStatus === 'submitted' ||
    contractStatus === 'pending' ||
    contractStatus === 'pending_approval'
  ) {
    return 'sign_contract';
  }

  if (
    status === 'dam_phan' ||
    status === 'negotiation' ||
    quote === 'sale_review' ||
    quote === 'ceo_review'
  ) {
    return 'negotiate';
  }

  // pending + with_solution (first write or chinh_sua revision) stay on
  // step 3 Chờ Solutions so the stepper keeps 6 steps and does not insert
  // 'AM làm Solution'. Still wins over a leftover bao_gia lead status.
  if (handoff === 'with_solution' || handoff === 'pending') return 'await_solutions';

  if (
    handoff === 'released' ||
    status === 'bao_gia' ||
    status === 'proposal' ||
    quote === 'chuyen_bao_gia' ||
    quote === 'bao_gia' ||
    quote === 'sale_approve_solution'
  ) {
    return 'await_quote';
  }

  // Returned to Sales for missing info, or not yet submitted.
  if (input.discoverySubmitted && handoff !== 'returned' && handoff !== '') {
    // unknown handoff after submit: still at AM queue if not returned
    if (handoff && handoff !== 'returned') return 'await_solutions';
  }

  if (
    status === 'dang_tu_van' ||
    status === 'consult' ||
    status === 'hen_gap' ||
    status === 'nurturing' ||
    input.discoverySubmitted ||
    handoff === 'returned' ||
    input.returnedToSales
  ) {
    return 'sales_brief';
  }

  if (status === 'da_lien_he' || status === 'contacted' || status === 'qualified') {
    // Contact done — Sales can start the Brief (Pre Sale). Treat as sales_brief
    // so the pipeline opens the Discovery panel, not a dead "receive" step.
    return 'sales_brief';
  }

  // Status may stay `moi` after the first call is logged. Once B2 is complete
  // the Brief form is the active pane, so the stepper/badge must sit on step 2.
  if (input.firstContactDone) return 'sales_brief';

  return 'receive_lead';
}

export function resolveHandoffFlow(input: HandoffFlowInput): HandoffFlowView {
  const currentKey = resolveHandoffFlowStep(input);
  const currentIndex = HANDOFF_FLOW_STEPS.find((s) => s.key === currentKey)?.index ?? 1;
  const times = timestampsForHandoffFlow(input);
  const steps: HandoffFlowStepView[] = HANDOFF_FLOW_STEPS.map((def) => {
    let state: HandoffFlowStepState = 'pending';
    if (def.index < currentIndex) state = 'done';
    else if (def.index === currentIndex) state = 'current';
    return {
      ...def,
      state,
      isActive: def.key === currentKey,
      at: state === 'pending' ? null : times[def.key] ?? null,
    };
  });
  return {
    currentKey,
    currentLabel: HANDOFF_FLOW_STATUS_LABELS[currentKey],
    steps,
    returnedToSales: Boolean(input.returnedToSales) || norm(input.handoffStatus) === 'returned',
  };
}

export function timestampsForHandoffFlow(
  input: HandoffFlowInput,
): Record<HandoffFlowStepKey, string | null> {
  return {
    receive_lead: firstIso(input.leadReceivedAt, input.leadCreatedAt),
    sales_brief: firstIso(input.discoverySubmittedAt, input.handedOffAt),
    await_solutions: firstIso(input.handedOffAt),
    doing_solutions: firstIso(input.solutionClaimedAt),
    await_quote: firstIso(input.solutionReleasedAt),
    negotiate: firstIso(input.quoteApprovedAt, input.quoteSentAt, input.customerAgreedAt),
    sign_contract: firstIso(input.contractSignedAt, input.contractCreatedAt),
    trien_khai: firstIso(input.contractSignedAt),
  };
}


/** Pull stepper timestamps from a funnel snapshot handoff / quote_case. */
export function flowTimesFromFunnel(funnel: {
  presales?: {
    handoff?: Record<string, unknown> | null;
    solution_case?: Record<string, unknown> | null;
    quote_case?: Record<string, unknown> | null;
  } | null;
} | null | undefined): Pick<
  HandoffFlowInput,
  | 'handedOffAt'
  | 'solutionClaimedAt'
  | 'solutionReleasedAt'
  | 'quoteSentAt'
  | 'quoteApprovedAt'
  | 'customerAgreedAt'
  | 'contractCreatedAt'
  | 'contractSignedAt'
> {
  const str = (obj: Record<string, unknown> | null | undefined, ...keys: string[]): string | null => {
    if (!obj) return null;
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return null;
  };
  const handoff = funnel?.presales?.handoff;
  const quote = funnel?.presales?.quote_case;
  const sol = funnel?.presales?.solution_case;
  return {
    handedOffAt: firstIso(str(handoff, 'handed_off_at')),
    solutionClaimedAt: firstIso(str(handoff, 'solution_claimed_at'), str(sol, 'claimed_at')),
    solutionReleasedAt: firstIso(str(handoff, 'solution_released_at'), str(sol, 'released_at')),
    quoteSentAt: firstIso(str(handoff, 'quote_offered_at'), str(quote, 'quote_sent_back_at'), str(handoff, 'quote_sent_back_at')),
    quoteApprovedAt: firstIso(str(handoff, 'quote_approved_at'), str(quote, 'quote_approved_at')),
    customerAgreedAt: firstIso(str(handoff, 'solution_approved_at'), str(quote, 'solution_approved_at'), str(quote, 'quote_accepted_at')),
    contractCreatedAt: firstIso(str(handoff, 'contract_created_at')),
    contractSignedAt: firstIso(str(handoff, 'contract_signed_at')),
  };
}

/** Display label for badges, Kanban, notifications — never raw slugs. */
export function handoffFlowStatusLabel(input: HandoffFlowInput): string {
  return HANDOFF_FLOW_STATUS_LABELS[resolveHandoffFlowStep(input)];
}

export interface HandoffKanbanColumn {
  id: string;
  label: string;
  stepKey?: HandoffFlowStepKey;
  statuses: readonly string[];
  handoffs?: readonly string[];
  collapsible: boolean;
}

/**
 * B2B Kanban columns for this flow. Stored status codes are unchanged;
 * handoff_status pulls leads out of "Đang tư vấn" into Chờ / AM làm Solution.
 */
export const HANDOFF_FLOW_KANBAN_COLUMNS: readonly HandoffKanbanColumn[] = [
  {
    id: 'moi',
    label: 'Tiếp nhận Lead',
    stepKey: 'receive_lead',
    statuses: ['moi', 'new', 'intake'],
    collapsible: false,
  },
  {
    id: 'sales_brief',
    label: 'Sales tư vấn & nhập Brief',
    stepKey: 'sales_brief',
    statuses: ['da_lien_he', 'first_contact', 'contacted', 'qualified', 'qualify', 'dang_tu_van', 'nurturing', 'hen_gap', 'consult'],
    collapsible: false,
  },
  {
    id: 'cho_solutions',
    label: 'Chờ Solutions',
    stepKey: 'await_solutions',
    statuses: [],
    handoffs: ['pending'],
    collapsible: false,
  },
  {
    id: 'dang_lam_solutions',
    label: 'AM làm Solution',
    stepKey: 'doing_solutions',
    statuses: [],
    handoffs: ['with_solution'],
    collapsible: false,
  },
  {
    id: 'bao_gia',
    label: 'Chờ báo giá',
    stepKey: 'await_quote',
    statuses: ['bao_gia', 'proposal'],
    handoffs: ['released'],
    collapsible: false,
  },
  {
    id: 'dam_phan',
    label: 'Chờ CEO duyệt',
    stepKey: 'negotiate',
    statuses: ['dam_phan', 'negotiation'],
    collapsible: false,
  },
  {
    id: 'won',
    label: 'Ký hợp đồng',
    stepKey: 'sign_contract',
    statuses: ['won', 'chot', 'post_sale'],
    collapsible: true,
  },
  {
    id: 'trien_khai',
    label: 'Triển Khai',
    stepKey: 'trien_khai',
    statuses: ['trien_khai'],
    collapsible: false,
  },
  {
    id: 'lost',
    label: 'Thất bại',
    statuses: ['lost'],
    collapsible: true,
  },
  {
    id: 'nurture',
    label: 'Chăm sóc lại',
    statuses: ['nurture'],
    collapsible: true,
  },
];

export interface HandoffKanbanLead {
  status?: string | null;
  solution_handoff?: string | null;
  quote_case_open?: boolean;
  has_contract?: boolean;
  quote_approved?: boolean;
}

/**
 * Place a lead into a HANDOFF_FLOW_KANBAN column. Handoff status wins over
 * the stored CRM status so a "Đang tư vấn" row with pending handoff sits in
 * Chờ Solutions — without rewriting historical status codes.
 */
export function kanbanColumnIdForLead(lead: HandoffKanbanLead): string {
  const view = resolveHandoffFlow({
    leadStatus: lead.status,
    handoffStatus: lead.solution_handoff,
    hasContract: Boolean(lead.has_contract),
    quotePhase: lead.status === 'trien_khai' ? 'trien_khai' : lead.quote_approved ? 'hop_dong' : lead.quote_case_open ? 'bao_gia' : null,
  });
  const col = HANDOFF_FLOW_KANBAN_COLUMNS.find((c) => c.stepKey === view.currentKey);
  if (col) return col.id;
  const status = norm(lead.status);
  for (const c of HANDOFF_FLOW_KANBAN_COLUMNS) {
    if (c.statuses.includes(status)) return c.id;
  }
  return '__other__';
}

export function bucketLeadsByHandoffFlow<T extends HandoffKanbanLead>(
  rows: T[],
): { stageKeys: string[]; byStage: Record<string, T[]> } {
  const byStage: Record<string, T[]> = {};
  for (const col of HANDOFF_FLOW_KANBAN_COLUMNS) byStage[col.id] = [];
  byStage.__other__ = [];
  for (const row of rows) {
    const id = kanbanColumnIdForLead(row);
    if (byStage[id]) byStage[id].push(row);
    else byStage.__other__.push(row);
  }
  const stageKeys = HANDOFF_FLOW_KANBAN_COLUMNS.map((c) => c.id);
  if (byStage.__other__.length > 0) stageKeys.push('__other__');
  return { stageKeys, byStage };
}

/* ---------- AM desk checklist (auto from Discovery completeness) ---------- */

export interface DiscoveryChecklistSource {
  company_name?: string;
  industry?: string;
  region?: string;
  flagship_product?: string;
  websites?: string;
  contact_name?: string;
  phone?: string;
  biggest_problem?: string;
  services?: string[];
  marketing_goal?: string;
  target_customers?: string;
  budget_band?: string;
  timeline_band?: string;
  call_notes?: string;
  temperature?: string;
}

export interface AmDeskChecklistItem {
  key: string;
  label: string;
  ok: boolean;
}

function filled(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => String(item ?? '').trim().length > 0);
  return String(value ?? '').trim().length > 0;
}

export type SalesDeskSideMode = 'notes' | 'brief' | 'stage';

/** Right-rail contents on the Sales desk, keyed off the 7-step flow. */
export function salesDeskSideMode(currentKey: string, returned = false): SalesDeskSideMode {
  if (returned || currentKey === 'sales_brief') return 'brief';
  if (currentKey === 'receive_lead' || !currentKey) return 'notes';
  return 'stage';
}

export function amDeskChecklist(
  brief: DiscoveryChecklistSource | null | undefined,
  opts?: { legacyReady?: boolean },
): {
  items: AmDeskChecklistItem[];
  allOk: boolean;
  /** Company+contact+need exist so AM may still giao a handed-off legacy lead. Not a 5th-item tick. */
  legacyAssignable: boolean;
  done: number;
  total: number;
} {
  const b = brief ?? {};
  const items: AmDeskChecklistItem[] = [
    {
      key: 'company',
      label: 'Thông tin doanh nghiệp đầy đủ',
      ok: filled(b.company_name) && filled(b.industry),
    },
    {
      key: 'need',
      label: 'Nhu cầu & vấn đề rõ ràng',
      ok: filled(b.biggest_problem) && Array.isArray(b.services) && b.services.length > 0,
    },
    {
      key: 'goal',
      label: 'Mục tiêu & đối tượng khách hàng',
      ok: filled(b.marketing_goal) && filled(b.target_customers),
    },
    {
      key: 'budget',
      label: 'Ngân sách & thời gian triển khai',
      ok: filled(b.budget_band) && filled(b.timeline_band),
    },
    {
      key: 'ready',
      label: 'Đủ điều kiện làm Solution',
      ok: false,
    },
  ];
  const firstFour = items.slice(0, 4).every((item) => item.ok);
  const contactOk = filled(b.contact_name) && filled(b.phone);
  const discoveryReady = firstFour && contactOk;
  const legacyReady =
    Boolean(opts?.legacyReady) &&
    contactOk &&
    filled(b.company_name) &&
    (filled(b.biggest_problem) || (Array.isArray(b.services) && b.services.length > 0));
  // Item 5 must mirror the real first-four + contact checklist. A handed-off
  // legacy lead does not get a false tick when goal/budget are missing.
  items[4] = { ...items[4], ok: discoveryReady };
  return { items, allOk: items[4].ok, legacyAssignable: legacyReady, done: items.filter((item) => item.ok).length, total: items.length };
}

export const DISCOVERY_CHECKLIST_TARGETS: Record<string, { step: number; testids: string[] }> = {
  company: { step: 1, testids: ['sd-company', 'sd-industry'] },
  need: { step: 2, testids: ['sd-service-picker', 'sd-problem'] },
  goal: { step: 2, testids: ['sd-goal', 'sd-audience'] },
  budget: { step: 3, testids: ['sd-budget', 'sd-timeline'] },
  ready: { step: 1, testids: ['sd-contact', 'sd-phone'] },
};

export function discoveryTargetsForChecklistKey(
  key: string,
  items?: AmDeskChecklistItem[],
  opts?: { preferSubmit?: boolean },
): { step: number; testids: string[] } {
  if (opts?.preferSubmit) return { step: 3, testids: ['sd-submit'] };
  if (key === 'ready' && items?.length) {
    const firstUnmet = items.find((item) => item.key !== 'ready' && !item.ok);
    if (firstUnmet) return discoveryTargetsForChecklistKey(firstUnmet.key);
  }
  return DISCOVERY_CHECKLIST_TARGETS[key] || { step: 1, testids: ['sales-discovery-wizard', 'sd-embed'] };
}

export function focusDiscoveryChecklistItem(
  key: string,
  items?: AmDeskChecklistItem[],
  opts?: { preferSubmit?: boolean },
): void {
  const target = discoveryTargetsForChecklistKey(key, items, opts);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('sld:focus-discovery', { detail: target }));
}


/** Format a timestamp in Asia/Saigon for stepper / meta rows. */
export function formatHandoffStamp(
  iso: string | null | undefined,
  opts: { dateOnly?: boolean } = {},
): string {
  const raw = String(iso ?? '').trim();
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return '';
  const fmt = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Saigon',
    day: '2-digit',
    month: '2-digit',
    year: opts.dateOnly ? undefined : 'numeric',
    hour: opts.dateOnly ? undefined : '2-digit',
    minute: opts.dateOnly ? undefined : '2-digit',
    hour12: false,
  });
  return fmt.format(new Date(ms)).replace(/,/g, '');
}

export function dash(value: string | null | undefined): string {
  const text = String(value ?? '').trim();
  return text || '—';
}

export function linesFromText(value: string | null | undefined): string[] {
  const text = String(value ?? '').trim();
  if (!text) return [];
  return text
    .split(/\r?\n|•/g)
    .map((line) => line.replace(/^\s*[-–]\s*/, '').trim())
    .filter(Boolean);
}

/** Split a brief field into idea-level bullets without dropping or rewriting text. */
export function splitBriefIdeas(value: string | null | undefined): string[] {
  const out: string[] = [];
  for (const seed of linesFromText(value)) {
    let parts = seed.split(/\s*[;；]\s*/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      parts = seed.split(/\s+\/\s+/).map((part) => part.trim()).filter(Boolean);
    }
    if (parts.length < 2) {
      parts = seed
        .split(/(?<=[.!?…])\s+(?=\S)/)
        .map((part) => part.trim())
        .filter(Boolean);
    }
    if (parts.length < 2) {
      parts = seed
        .split(/(?:^|\s+)\d+[.)]\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
    }
    out.push(...(parts.length ? parts : [seed]));
  }
  return out;
}

export const HANDOFF_FLOW_COPY = {
  submitToAm: 'Đã Submit to AM. Lead đang ở Chờ Solutions.',
  assignedToMarketing: 'Đã giao case Solutions.',
  returnedToSales: 'Đã trả về Sales. Lead quay lại Pre Sale (Sales tư vấn & nhập Brief).',
  releasedToQuote: 'Đã nộp Solution cho Sales. Lead chuyển sang bước Sales lấy phản hồi khách.',
  confirmRelease: 'Nộp Solution cho Sales và chuyển lead sang bước Sales lấy phản hồi khách?',
  confirmReturn: 'Trả về Sales? Lead sẽ quay lại bước Sales tư vấn & nhập Brief để bổ sung thông tin.',
} as const;
