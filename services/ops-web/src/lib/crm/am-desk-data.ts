/**
 * Merge Discovery brief with legacy lead / party / consult / intake / BANT
 * sources so the AM desk never shows a wall of "—" when older records
 * already hold usable data.
 */
import {
  parseWebsiteBundle,
  readDiscoveryBriefFromAnswers,
  type SalesDiscoveryBrief,
} from './sales-discovery';

export function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => isFilled(item));
  const text = String(value ?? '').trim();
  return text.length > 0 && text !== '—';
}

export function firstFilled(...values: unknown[]): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const joined = value
        .map((item) => String(item ?? '').trim())
        .filter((item) => item && item !== '—');
      if (joined.length) return joined.join('\n');
    } else if (isFilled(value)) {
      return String(value).trim();
    }
  }
  return '';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function hrefForUrl(url: string): string | undefined {
  const text = String(url ?? '').trim();
  if (!text || text === '—') return undefined;
  if (/^https?:\/\//i.test(text)) return text;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(text) || /facebook\.com|tiktok\.com|zalo\./i.test(text)) {
    return `https://${text}`;
  }
  return undefined;
}

const SOURCE_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  facebook: 'Facebook',
  fb: 'Facebook',
  google: 'Google',
  website: 'Website',
  zalo: 'Zalo',
  referral: 'Giới thiệu',
  manual: 'Nhập tay',
  hotline: 'Hotline',
  ads: 'Quảng cáo',
  organic: 'Hữu cơ',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

export function humanizeSource(source: string): string {
  const key = String(source ?? '').trim();
  if (!key) return '';
  return SOURCE_LABELS[key.toLowerCase()] || key;
}

function formatHighlights(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        const rec = asRecord(item);
        return firstFilled(rec.text, rec.note, rec.value, rec.title);
      })
      .filter(isFilled)
      .join('\n');
  }
  const rec = asRecord(raw);
  return Object.values(rec)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(isFilled)
    .join('\n');
}

function bantSummary(answers: Record<string, unknown>, session: Record<string, unknown>): string {
  const parts: string[] = [];
  const score = session.bant_score ?? session.bant_total ?? answers.bant_score ?? answers.bant;
  const checklist = asRecord(answers.bant_checklist);
  const total =
    typeof score === 'number'
      ? score
      : Number(
          Object.values(checklist).reduce((sum: number, item) => {
            const n = Number(item);
            return sum + (Number.isFinite(n) ? n : 0);
          }, 0),
        ) || null;
  if (total != null && Number.isFinite(Number(total)) && Number(total) > 0) {
    parts.push(`BANT ${total}/${session.bant_max ?? answers.bant_max ?? 30}`);
  }
  const decision = firstFilled(session.decision, answers.decision);
  if (decision) parts.push(`Quyết định: ${String(decision).toUpperCase()}`);
  const reason = firstFilled(session.decision_reason, answers.decision_reason, answers.reason);
  if (reason) parts.push(reason);
  const temp = firstFilled(session.lead_temperature, answers.lead_temperature, answers.temperature);
  if (temp) parts.push(`Nhiệt độ: ${temp}`);
  return parts.join(' · ');
}

export type AmDeskLeadLike = {
  full_name?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  source?: string | null;
  channel?: string | null;
  notes?: string | null;
  need?: string | null;
  industry?: string | null;
  job_title?: string | null;
  owner_name?: string | null;
};

export type AmDeskPartyLike = {
  company_name?: string | null;
  contact_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  job_title?: string | null;
  industry?: string | null;
  address?: string | null;
  company_address?: string | null;
  website?: string | null;
  fanpage?: string | null;
  tiktok?: string | null;
  logo_url?: string | null;
  scale?: string | null;
};

export type AmDeskSessionLike = {
  company_name?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  lead_temperature?: string | null;
  service_slug?: string | null;
  decision?: string | null;
  decision_reason?: string | null;
  answers_json?: unknown;
  bant_score?: number | null;
  bant_max?: number | null;
  notes?: string | null;
  status?: string | null;
};

export type AmDeskConsultLike = {
  brief?: unknown;
  highlights?: unknown;
  latest_intake_summary?: string | null;
  recommended_actions?: string | string[] | null;
  facts?: { company_name?: string; niche?: string; need?: string } | null;
};

export type AmDeskClientBriefLike = {
  brief?: unknown;
  facts?: { company_name?: string; niche?: string; need?: string } | null;
};

export type AmDeskDataSources = {
  discovery?: Partial<SalesDiscoveryBrief> | null;
  lead?: AmDeskLeadLike | null;
  party?: AmDeskPartyLike | null;
  session?: AmDeskSessionLike | null;
  consult?: AmDeskConsultLike | null;
  clientBrief?: AmDeskClientBriefLike | null;
  presalesNotes?: string | null;
  serviceSlug?: string | null;
};

export type AmDeskMerged = {
  company_name: string;
  industry: string;
  region: string;
  websites: string;
  website: string;
  fanpage: string;
  tiktok: string;
  scale: string;
  model: string;
  contact_name: string;
  job_title: string;
  phone: string;
  email: string;
  budget_authority: string;
  budget_approver: string;
  marketing_goal: string;
  services: string[];
  biggest_problem: string;
  channels: string[];
  channels_text: string;
  current_budget: string;
  current_results: string;
  difficulties: string;
  target_customers: string;
  budget_band: string;
  timeline_band: string;
  flagship_product: string;
  call_notes: string;
  temperature: string;
  source: string;
  hasDiscovery: boolean;
  isLegacy: boolean;
};

export function buildAmDeskBrief(sources: AmDeskDataSources): AmDeskMerged {
  const session = sources.session ?? {};
  const fromAnswers = readDiscoveryBriefFromAnswers(session.answers_json);
  const discovery = sources.discovery ?? fromAnswers;
  const d = (discovery ?? {}) as Partial<SalesDiscoveryBrief>;
  const lead = sources.lead ?? {};
  const party = sources.party ?? {};
  const answers = asRecord(session.answers_json);
  const crm = asRecord(answers.crm_fields);
  const consult = asRecord(sources.consult);
  const consultBrief = asRecord(consult.brief);
  const client = asRecord(sources.clientBrief);
  const clientBrief = asRecord(client.brief);
  const facts = {
    ...asRecord(consult.facts),
    ...asRecord(client.facts),
  };

  const company_name = firstFilled(
    d.company_name,
    party.company_name,
    lead.company_name,
    session.company_name,
    facts.company_name,
  );
  const industry = firstFilled(
    d.industry,
    party.industry,
    lead.industry,
    crm.industry,
    consultBrief.niche,
    consultBrief.industry,
    facts.niche,
    facts.industry,
  );
  const region = firstFilled(
    d.region,
    crm.region,
    party.address,
    party.company_address,
    lead.company_address,
    consultBrief.region,
  );

  const parsed = parseWebsiteBundle(String(d.websites ?? ''));
  const website = firstFilled(
    parsed.website,
    crm.website,
    clientBrief.website,
    consultBrief.website,
    lead.website,
    party.website,
  );
  const fanpage = firstFilled(
    parsed.fanpage,
    crm.fanpage,
    clientBrief.fanpage,
    consultBrief.fanpage,
    party.fanpage,
  );
  const tiktok = firstFilled(
    parsed.tiktok,
    crm.tiktok,
    clientBrief.tiktok,
    consultBrief.tiktok,
    party.tiktok,
  );
  const websites = firstFilled(d.websites, [website, fanpage, tiktok].filter(isFilled).join('\n'));

  const contact_name = firstFilled(
    d.contact_name,
    party.contact_name,
    party.full_name,
    lead.full_name,
    session.contact_name,
  );
  const job_title = firstFilled(
    d.job_title,
    party.job_title,
    lead.job_title,
    session.contact_role,
    crm.job_title,
  );
  const phone = firstFilled(d.phone, party.phone, lead.phone, session.phone, crm.phone);
  const email = firstFilled(d.email, party.email, lead.email, session.email, crm.email);
  const budget_authority = firstFilled(d.budget_authority, crm.budget_authority);
  const budget_approver = firstFilled(
    (d as { budget_approver?: string }).budget_approver,
    crm.budget_approver,
  );

  const biggest_problem = firstFilled(
    d.biggest_problem,
    facts.need,
    answers.need,
    crm.need,
    lead.need,
    consultBrief.need,
    consultBrief.current_status,
  );
  const marketing_goal = firstFilled(
    d.marketing_goal,
    clientBrief.goal,
    consultBrief.goal,
    crm.goal,
    answers.goal,
  );
  const target_customers = firstFilled(
    d.target_customers,
    clientBrief.audience,
    consultBrief.target_audience,
    consultBrief.doi_tuong_muc_tieu,
    crm.target_audience,
    answers.target_audience,
  );
  const flagship_product = firstFilled(
    d.flagship_product,
    d.priority_product,
    crm.flagship_product,
    crm.priority_product,
    consultBrief.flagship_product,
  );
  const budget_band = firstFilled(d.budget_band, crm.budget_band);
  const timeline_band = firstFilled(d.timeline_band, crm.timeline_band);
  const current_results = firstFilled(
    d.current_results,
    crm.current_state,
    answers.current_state,
    consultBrief.metrics,
  );
  const difficulties = firstFilled(d.difficulties, crm.difficulties);
  const current_budget = firstFilled(
    (d as { current_budget?: string }).current_budget,
    crm.current_budget,
  );
  const scale = firstFilled(
    (d as { scale?: string }).scale,
    crm.scale,
    crm.company_size,
    party.scale,
  );
  const model = firstFilled(
    (d as { model?: string }).model,
    crm.model,
    crm.business_model,
  );

  let services: string[] = [];
  if (Array.isArray(d.services) && d.services.some((item) => isFilled(item))) {
    services = d.services.map((item) => String(item).trim()).filter(isFilled);
  } else {
    const slug = firstFilled(session.service_slug, sources.serviceSlug, answers.service_slug, crm.service_slug);
    if (slug && slug !== '_common') services = [slug];
  }

  const channels = Array.isArray(d.channels)
    ? d.channels.map((item) => String(item).trim()).filter(isFilled)
    : [];
  const source = firstFilled(lead.source, lead.channel, session.source, answers.source);
  const sourceLabel = humanizeSource(source);
  const sourceIsChannel = /tiktok|facebook|instagram|google|youtube|zalo|website|ads|organic|hotline/i.test(source);
  const channels_text = firstFilled(
    channels.length ? channels.join(', ') : '',
    typeof clientBrief.channels === 'string' ? clientBrief.channels : '',
    typeof consultBrief.channels === 'string' ? consultBrief.channels : '',
    typeof crm.channels === 'string' ? crm.channels : '',
    sourceIsChannel ? sourceLabel : '',
  );

  const highlightText = formatHighlights(consult.highlights);
  const recommended = firstFilled(
    Array.isArray(consult.recommended_actions)
      ? (consult.recommended_actions as unknown[]).filter(isFilled)
      : consult.recommended_actions,
  );
  const intakeSummary = firstFilled(consult.latest_intake_summary);
  const bant = bantSummary(answers, asRecord(session));
  const call_notes = firstFilled(
    d.call_notes,
    answers.notes,
    crm.notes,
    sources.presalesNotes,
    lead.notes,
    highlightText,
    intakeSummary,
    recommended,
    bant,
    session.decision_reason,
    session.notes,
  );

  const temperature = firstFilled(
    d.temperature,
    session.lead_temperature,
    answers.lead_temperature,
    answers.temperature,
  );

  const hasDiscovery = Boolean(
    fromAnswers ||
      sources.discovery ||
      (discovery && isFilled(d.company_name) && isFilled(d.biggest_problem)),
  );
  const isLegacy = !fromAnswers && !sources.discovery;

  return {
    company_name,
    industry,
    region,
    websites,
    website,
    fanpage,
    tiktok,
    scale,
    model,
    contact_name,
    job_title,
    phone,
    email,
    budget_authority,
    budget_approver,
    marketing_goal,
    services,
    biggest_problem,
    channels,
    channels_text,
    current_budget,
    current_results,
    difficulties,
    target_customers,
    budget_band,
    timeline_band,
    flagship_product,
    call_notes,
    temperature,
    source,
    hasDiscovery,
    isLegacy,
  };
}

/** Checklist source derived from the merged desk view. */
export function checklistSourceFromMerged(view: AmDeskMerged) {
  return {
    company_name: view.company_name,
    industry: view.industry,
    region: view.region,
    flagship_product: view.flagship_product,
    websites: view.websites,
    contact_name: view.contact_name,
    phone: view.phone,
    biggest_problem: view.biggest_problem,
    services: view.services,
    marketing_goal: view.marketing_goal,
    target_customers: view.target_customers,
    budget_band: view.budget_band,
    timeline_band: view.timeline_band,
    call_notes: view.call_notes,
    temperature: view.temperature,
  };
}
