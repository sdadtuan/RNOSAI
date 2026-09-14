/**
 * Optional VN legal / Places enrich (SRS §9B.3 — H3c).
 *
 * Enable: PTT_RESEARCH_HARVEST_LEGAL_ENRICH=1
 *
 * Adapter hook: set PTT_RESEARCH_HARVEST_LEGAL_ADAPTER=stub|http
 * - stub (default): always unverified — no external call
 * - http: POST JSON to PTT_RESEARCH_HARVEST_LEGAL_URL with
 *   { company_name, address, province_name, phone, website }
 *   expecting { status: 'verified'|'unverified'|'mismatch', detail?: string }
 *
 * Score impact only (never hard-fail the whole job):
 * - verified → +10 quality
 * - mismatch → −5 quality (soft)
 * - unverified → no change
 */

export type LegalStatus = 'verified' | 'unverified' | 'mismatch';

export type LegalEnrichInput = {
  company_name: string;
  address: string | null;
  province_name: string;
  phone: string | null;
  website: string | null;
};

export type LegalEnrichResult = {
  status: LegalStatus;
  detail: string;
  source: 'stub' | 'http' | 'skip';
};

export function legalEnrichEnabled(): boolean {
  const raw = String(process.env.PTT_RESEARCH_HARVEST_LEGAL_ENRICH ?? '').trim();
  return raw === '1' || raw.toLowerCase() === 'true';
}

export function applyLegalStatusScoreBoost(score: number, status: LegalStatus): number {
  if (status === 'verified') return Math.min(100, score + 10);
  if (status === 'mismatch') return Math.max(0, score - 5);
  return score;
}

function normalizeStatus(raw: unknown): LegalStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'verified' || s === 'mismatch' || s === 'unverified') return s;
  return 'unverified';
}

/**
 * Stub / HTTP adapter. When flag off, caller should skip entirely.
 */
export async function enrichLegalStatus(
  input: LegalEnrichInput,
  opts?: { timeoutMs?: number },
): Promise<LegalEnrichResult> {
  const adapter = String(process.env.PTT_RESEARCH_HARVEST_LEGAL_ADAPTER ?? 'stub')
    .trim()
    .toLowerCase();

  if (adapter === 'http') {
    const url = String(process.env.PTT_RESEARCH_HARVEST_LEGAL_URL ?? '').trim();
    if (!url) {
      return {
        status: 'unverified',
        detail: 'legal_adapter_url_missing',
        source: 'stub',
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 8000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(input),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        return {
          status: 'unverified',
          detail: `legal_http_${res.status}`,
          source: 'http',
        };
      }
      return {
        status: normalizeStatus(body.status),
        detail: String(body.detail ?? 'http_ok').slice(0, 200),
        source: 'http',
      };
    } catch (err) {
      return {
        status: 'unverified',
        detail: err instanceof Error ? err.message : 'legal_http_failed',
        source: 'http',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // Default stub — hook for MST/Places when wired
  void input;
  return {
    status: 'unverified',
    detail: 'adapter_not_configured',
    source: 'stub',
  };
}
