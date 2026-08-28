/** Phase 2 — CRM write-back for LMP identity discovery (meta_json.lmp_discover). */

export type LmpDiscoverSource = 'auto' | 'am_manual' | 'am_confirmed' | 'ingest';

export type LmpDiscoverMeta = {
  candidate_id?: string | null;
  source_url?: string | null;
  discovered_at?: string | null;
  discover_status?: string | null;
  discover_source?: LmpDiscoverSource | null;
  confirmed_by_am?: boolean;
  confirmed_by?: string | null;
};

export type LmpLeadIdentity = {
  company_name: string | null;
  website_url: string | null;
  discover_source: LmpDiscoverSource | null;
  confirmed_by_am: boolean | null;
  source_url: string | null;
  candidate_id: string | null;
};

export function extractLmpDiscoverMeta(
  metaJson: Record<string, unknown> | null | undefined,
): LmpDiscoverMeta | null {
  if (!metaJson || typeof metaJson !== 'object') return null;
  const block = metaJson.lmp_discover;
  if (!block || typeof block !== 'object') return null;
  return block as LmpDiscoverMeta;
}

export function extractLmpLeadIdentity(
  metaJson: Record<string, unknown> | null | undefined,
): LmpLeadIdentity | null {
  if (!metaJson || typeof metaJson !== 'object') return null;
  const discover = extractLmpDiscoverMeta(metaJson);
  const company =
    typeof metaJson.company_name === 'string' ? metaJson.company_name.trim() : '';
  const website =
    typeof metaJson.website_url === 'string' ? metaJson.website_url.trim() : '';
  if (!discover && !company && !website) return null;

  return {
    company_name: company || null,
    website_url: website || null,
    discover_source: (discover?.discover_source as LmpDiscoverSource | undefined) ?? null,
    confirmed_by_am:
      discover?.confirmed_by_am === undefined ? null : Boolean(discover.confirmed_by_am),
    source_url:
      typeof discover?.source_url === 'string' ? discover.source_url.trim() || null : null,
    candidate_id:
      typeof discover?.candidate_id === 'string' ? discover.candidate_id.trim() || null : null,
  };
}

export function discoverSourceLabelVi(source: LmpDiscoverSource | null | undefined): string {
  switch (source) {
    case 'auto':
      return 'AI tự tìm';
    case 'am_manual':
      return 'AM nhập tay';
    case 'am_confirmed':
      return 'AM xác nhận';
    case 'ingest':
      return 'Form ingest';
    default:
      return 'Chưa xác định';
  }
}

export function buildDiscoverSelectionMetaPatch(
  discoverResult: Record<string, unknown>,
  candidateId: string,
  options: { confirmedByAm?: boolean; actorEmail?: string | null } = {},
): Record<string, unknown> {
  const confirmedByAm = Boolean(options.confirmedByAm);
  const discoverSource: LmpDiscoverSource = confirmedByAm ? 'am_confirmed' : 'auto';
  const candidates = Array.isArray(discoverResult.candidates) ? discoverResult.candidates : [];
  const cand = candidates.find(
    (row) =>
      row &&
      typeof row === 'object' &&
      String((row as Record<string, unknown>).candidate_id ?? '') === candidateId,
  ) as Record<string, unknown> | undefined;
  if (!cand) return {};

  const meta = discoverResult.meta as Record<string, unknown> | undefined;
  const lmpDiscover: LmpDiscoverMeta = {
    candidate_id: candidateId,
    source_url:
      typeof cand.source_url === 'string'
        ? cand.source_url
        : typeof cand.website_url === 'string'
          ? cand.website_url
          : null,
    discovered_at: typeof meta?.discovered_at === 'string' ? meta.discovered_at : null,
    discover_status:
      typeof discoverResult.discover_status === 'string' ? discoverResult.discover_status : null,
    discover_source: discoverSource,
    confirmed_by_am: confirmedByAm,
  };
  if (options.actorEmail?.trim()) {
    lmpDiscover.confirmed_by = options.actorEmail.trim();
  }

  const patch: Record<string, unknown> = { lmp_discover: lmpDiscover };
  if (typeof cand.company_name === 'string' && cand.company_name.trim()) {
    patch.company_name = cand.company_name.trim();
  }
  if (typeof cand.website_url === 'string' && cand.website_url.trim()) {
    patch.website_url = cand.website_url.trim();
  }
  return patch;
}

export function buildAmManualIdentityMetaPatch(input: {
  companyName: string;
  websiteUrl?: string | null;
  actorEmail?: string | null;
}): Record<string, unknown> {
  const companyName = input.companyName.trim();
  const websiteUrl = input.websiteUrl?.trim() || null;
  const now = new Date().toISOString();
  const lmpDiscover: LmpDiscoverMeta = {
    candidate_id: null,
    source_url: websiteUrl,
    discovered_at: now,
    discover_status: 'am_manual',
    discover_source: 'am_manual',
    confirmed_by_am: true,
  };
  if (input.actorEmail?.trim()) {
    lmpDiscover.confirmed_by = input.actorEmail.trim();
  }

  const patch: Record<string, unknown> = {
    company_name: companyName,
    lmp_discover: lmpDiscover,
  };
  if (websiteUrl) patch.website_url = websiteUrl;
  return patch;
}
