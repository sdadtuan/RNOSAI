export type BattlecardClusterMate = {
  id: number;
  company_name: string;
  priority_tier?: string | null;
  phone?: string | null;
  readiness_status?: string | null;
};

export type BattlecardCrossProjectMate = {
  id: number;
  project_id: number;
  project_name?: string | null;
  company_name: string;
  priority_tier?: string | null;
  readiness_status?: string | null;
  phone?: string | null;
  status?: string;
};

export type BattlecardLeadInput = {
  id: number;
  company_name: string;
  address?: string | null;
  phone?: string | null;
  phone_norm?: string | null;
  email?: string | null;
  contact_title?: string | null;
  website?: string | null;
  fanpage_url?: string | null;
  zalo_url?: string | null;
  evidence_url?: string | null;
  evidence_snippet?: string | null;
  place_id?: string | null;
  quality_score?: number | null;
  icp_fit_score?: number | null;
  intent_score?: number | null;
  contactable?: boolean;
  readiness_status?: string | null;
  classification?: string | null;
  priority_tier?: string | null;
  account_cluster_key?: string | null;
  global_account_key?: string | null;
  dial_outcome?: string | null;
  feedback_code?: string | null;
};

export type RawLeadBattlecard = {
  version: 1;
  lead_id: number;
  generated_at: string;
  headline: string;
  priority_tier: string | null;
  readiness_status: string | null;
  classification: string | null;
  scores: { quality: number; icp: number; intent: number | null };
  why_call_now: string[];
  contact: {
    phone: string | null;
    email: string | null;
    website: string | null;
    fanpage_url: string | null;
    zalo_url: string | null;
    address: string | null;
    contact_title: string | null;
  };
  evidence: {
    url: string | null;
    snippet: string | null;
    place_id: string | null;
  };
  talking_points: string[];
  risks: string[];
  next_actions: string[];
  cluster: {
    key: string | null;
    mates: BattlecardClusterMate[];
  };
  cross_project: {
    key: string | null;
    mates: BattlecardCrossProjectMate[];
  };
  research_account: {
    id: number;
    display_name: string;
    lead_count: number;
    project_count: number;
    crm_lead_id: number | null;
    best_priority_tier: string | null;
  } | null;
  dial_outcome: string | null;
  feedback_code: string | null;
};

function nz(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim();
  return s ? s : null;
}

function hasPhone(lead: BattlecardLeadInput): boolean {
  const digits =
    String(lead.phone_norm ?? '').replace(/\D+/g, '') ||
    String(lead.phone ?? '').replace(/\D+/g, '');
  return digits.length >= 9;
}

function buildWhyCallNow(lead: BattlecardLeadInput): string[] {
  const out: string[] = [];
  const tier = String(lead.priority_tier ?? '').toUpperCase();
  const ready = String(lead.readiness_status ?? '').toUpperCase();
  const quality = Number(lead.quality_score ?? 0) || 0;
  const intent = lead.intent_score == null ? null : Number(lead.intent_score);

  if (tier === 'P1') out.push('Ưu tiên cao (P1) — sẵn sàng gọi sớm.');
  if (ready === 'READY_TO_PUSH') out.push('Đã READY_TO_PUSH — đủ điều kiện push CRM.');
  if (quality >= 70) out.push('Quality score cao.');
  if (intent != null && Number.isFinite(intent) && intent >= 0.6) {
    out.push('Intent Places mạnh.');
  }
  if ((lead.contactable || hasPhone(lead)) && hasPhone(lead)) {
    out.push('Có SĐT contactable.');
  }
  if (!out.length) out.push('Cần review trước khi gọi.');
  return out;
}

function buildTalkingPoints(lead: BattlecardLeadInput): string[] {
  const points: string[] = [];
  const name = nz(lead.company_name) ?? 'Công ty';
  const addr = nz(lead.address);
  points.push(addr ? `Mở đầu: ${name} · ${addr}.` : `Mở đầu: xin gặp phụ trách tại ${name}.`);

  if (nz(lead.website) || nz(lead.fanpage_url)) {
    points.push('Xác nhận dịch vụ trên web/FB trước khi pitch.');
  }
  const icp = Number(lead.icp_fit_score ?? 0) || 0;
  if (icp >= 50) points.push('ICP fit khá — bám ngành đã harvest.');

  const snippet = nz(lead.evidence_snippet);
  if (snippet) {
    const short = snippet.length > 120 ? `${snippet.slice(0, 117)}…` : snippet;
    points.push(`Evidence: ${short}`);
  }

  const title = nz(lead.contact_title);
  if (title) points.push(`Xin gặp ${title}.`);

  return points.slice(0, 5);
}

function buildRisks(
  lead: BattlecardLeadInput,
  mates: BattlecardClusterMate[],
  crossMates: BattlecardCrossProjectMate[],
): string[] {
  const risks: string[] = [];
  const ready = String(lead.readiness_status ?? '').toUpperCase();
  const dial = String(lead.dial_outcome ?? '').toLowerCase();
  const feedback = String(lead.feedback_code ?? '').toLowerCase();

  if (ready === 'MISSING_CONTACT' || !hasPhone(lead)) {
    risks.push('Thiếu SĐT / contact — khó gọi trực tiếp.');
  }
  if (ready === 'DUPLICATE_OR_BLACKLIST') {
    risks.push('Trùng hoặc blacklist — không push khi chưa xác minh.');
  }
  if (dial === 'wrong_number' || dial === 'out_of_business' || dial === 'email_bounced') {
    risks.push(`Dial trước đó: ${dial} — kiểm tra lại contact.`);
  }
  if (dial === 'gatekeeper') {
    risks.push('Trước đó gặp lễ tân (gatekeeper) — chuẩn bị script qua cổng.');
  }
  if (feedback === 'bad_phone' || feedback === 'bad_email') {
    risks.push(`Feedback: ${feedback} — dữ liệu contact nghi ngờ.`);
  }
  if (feedback === 'fake_company') {
    risks.push('Feedback: công ty ảo — xác minh MST/Places trước.');
  }
  if (feedback === 'wrong_geo') {
    risks.push('Feedback: sai địa bàn — xác nhận geo trước khi pitch.');
  }
  if (mates.length > 0) {
    risks.push('Cùng account cluster — tránh gọi trùng chi nhánh.');
  }
  if (crossMates.length > 0) {
    risks.push('Có lead cùng account ở project khác — kiểm tra lịch sử trước khi gọi.');
  }
  return risks;
}

function buildNextActions(lead: BattlecardLeadInput): string[] {
  const actions: string[] = [];
  const ready = String(lead.readiness_status ?? '').toUpperCase();
  const tier = String(lead.priority_tier ?? '').toUpperCase();

  if (!hasPhone(lead) || ready === 'MISSING_CONTACT') {
    actions.push('Bổ sung contact / Places enrich.');
  } else if (ready === 'NEEDS_REVIEW' || !ready) {
    actions.push('Review evidence rồi Accept.');
  } else if (ready === 'READY_TO_PUSH' && (tier === 'P1' || tier === 'P2')) {
    actions.push('Gọi SĐT · ghi dial outcome.');
  } else if (ready === 'READY_TO_PUSH') {
    actions.push('Push CRM khi đã xác nhận.');
  } else {
    actions.push('Review readiness trước khi gọi.');
  }
  actions.push('Cập nhật feedback nếu sai dữ liệu.');
  return actions;
}

export function buildRawLeadBattlecard(input: {
  lead: BattlecardLeadInput;
  clusterMates?: BattlecardClusterMate[];
  crossProjectMates?: BattlecardCrossProjectMate[];
  researchAccount?: {
    id: number;
    display_name: string;
    lead_count: number;
    project_count: number;
    crm_lead_id: number | null;
    best_priority_tier?: string | null;
  } | null;
  now?: Date;
}): RawLeadBattlecard {
  const lead = input.lead;
  const mates = (input.clusterMates ?? []).slice(0, 8);
  const crossMates = (input.crossProjectMates ?? []).slice(0, 12);
  const tier = nz(lead.priority_tier);
  const company = nz(lead.company_name) ?? `Lead #${lead.id}`;
  const headline = tier ? `${company} · ${tier}` : company;
  const ra = input.researchAccount ?? null;

  return {
    version: 1,
    lead_id: lead.id,
    generated_at: (input.now ?? new Date()).toISOString(),
    headline,
    priority_tier: tier,
    readiness_status: nz(lead.readiness_status),
    classification: nz(lead.classification),
    scores: {
      quality: Number(lead.quality_score ?? 0) || 0,
      icp: Number(lead.icp_fit_score ?? 0) || 0,
      intent: lead.intent_score == null ? null : Number(lead.intent_score),
    },
    why_call_now: buildWhyCallNow(lead),
    contact: {
      phone: nz(lead.phone),
      email: nz(lead.email),
      website: nz(lead.website),
      fanpage_url: nz(lead.fanpage_url),
      zalo_url: nz(lead.zalo_url),
      address: nz(lead.address),
      contact_title: nz(lead.contact_title),
    },
    evidence: {
      url: nz(lead.evidence_url),
      snippet: nz(lead.evidence_snippet),
      place_id: nz(lead.place_id),
    },
    talking_points: buildTalkingPoints(lead),
    risks: buildRisks(lead, mates, crossMates),
    next_actions: buildNextActions(lead),
    cluster: {
      key: nz(lead.account_cluster_key),
      mates,
    },
    cross_project: {
      key: nz(lead.global_account_key),
      mates: crossMates,
    },
    research_account: ra
      ? {
          id: ra.id,
          display_name: ra.display_name,
          lead_count: ra.lead_count,
          project_count: ra.project_count,
          crm_lead_id: ra.crm_lead_id,
          best_priority_tier: ra.best_priority_tier ?? null,
        }
      : null,
    dial_outcome: nz(lead.dial_outcome),
    feedback_code: nz(lead.feedback_code),
  };
}
