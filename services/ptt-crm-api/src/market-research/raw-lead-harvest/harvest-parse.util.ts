export type HarvestAiLead = {
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  contact_title: string | null;
  website: string | null;
  fanpage_url: string | null;
  zalo_url: string | null;
  evidence_url: string;
  evidence_snippet: string;
  discovered_via_source_key: string | null;
  confidence: number;
  field_sources: {
    phone: string | null;
    email: string | null;
    address: string | null;
  };
};

function asNullableString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/** Accept http(s) URLs or bare facebook/zalo hosts; else null. */
export function normalizeChannelUrl(
  raw: unknown,
  kind: 'fanpage' | 'zalo' | 'any',
): string | null {
  const s = asNullableString(raw);
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    const host = u.hostname.toLowerCase();
    if (kind === 'fanpage') {
      if (!/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)m\.facebook\.com$/.test(host)) {
        return null;
      }
    }
    if (kind === 'zalo') {
      if (!/(^|\.)zalo\.me$|(^|\.)zaloapp\.com$/.test(host)) return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

function extractJsonArray(raw: string): unknown[] {
  const text = String(raw ?? '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { leads?: unknown }).leads)) {
      return (parsed as { leads: unknown[] }).leads;
    }
  } catch {
    /* try fenced / substring */
  }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      const parsed = JSON.parse(fence[1].trim()) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* ignore */
    }
  }
  return [];
}

export function parseHarvestAiLeads(
  raw: string,
  opts: {
    mode: 'quality' | 'volume' | 'marketing' | 'intent' | 'market_graph';
    sourceKeys: string[];
  },
): HarvestAiLead[] {
  const rows = extractJsonArray(raw);
  const allowed = new Set(opts.sourceKeys.map(String));
  const out: HarvestAiLead[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const company = asNullableString(r.company_name);
    const evidenceUrl = asNullableString(r.evidence_url);
    if (!company) continue;
    if (
      (opts.mode === 'quality' ||
        opts.mode === 'marketing' ||
        opts.mode === 'intent' ||
        opts.mode === 'market_graph') &&
      !evidenceUrl
    ) {
      continue;
    }
    if (!evidenceUrl) continue;

    let via = asNullableString(r.discovered_via_source_key);
    if (via && !allowed.has(via)) via = null;

    const fsRaw =
      r.field_sources && typeof r.field_sources === 'object'
        ? (r.field_sources as Record<string, unknown>)
        : {};

    const confidenceNum = Number(r.confidence);
    out.push({
      company_name: company,
      address: asNullableString(r.address),
      phone: asNullableString(r.phone),
      email: asNullableString(r.email),
      contact_title: asNullableString(r.contact_title),
      website: asNullableString(r.website),
      fanpage_url:
        normalizeChannelUrl(r.fanpage_url ?? r.fanpage, 'fanpage') ??
        normalizeChannelUrl(r.evidence_url, 'fanpage'),
      zalo_url: normalizeChannelUrl(r.zalo_url ?? r.zalo, 'zalo'),
      evidence_url: evidenceUrl,
      evidence_snippet: asNullableString(r.evidence_snippet) ?? company,
      discovered_via_source_key: via,
      confidence: Number.isFinite(confidenceNum) ? Math.max(0, Math.min(1, confidenceNum)) : 0,
      field_sources: {
        phone: asNullableString(fsRaw.phone),
        email: asNullableString(fsRaw.email),
        address: asNullableString(fsRaw.address),
      },
    });
  }
  return out;
}
