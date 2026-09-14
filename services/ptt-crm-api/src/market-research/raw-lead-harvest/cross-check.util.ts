export type CrossCheckVerdict = 'confirm' | 'deny' | 'uncertain';

export type CrossCheckLeadInput = {
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  evidence_url: string;
  province_name: string;
};

export type ParsedCrossCheck = {
  verdict: CrossCheckVerdict;
  confidence: number;
  reason: string;
};

/**
 * Provider B only confirms existence + contact match — not a full re-harvest.
 */
export function buildCrossCheckPrompt(lead: CrossCheckLeadInput): string {
  return [
    'Bạn là verifier độc lập. Chỉ xác nhận dựa trên kiến thức/nguồn công khai.',
    'Không bịa SĐT/email mới. Không mở rộng sang công ty khác.',
    `Công ty: ${lead.company_name}`,
    `Địa bàn filter: ${lead.province_name}`,
    `Địa chỉ claim: ${lead.address ?? '(null)'}`,
    `SĐT claim: ${lead.phone ?? '(null)'}`,
    `Email claim: ${lead.email ?? '(null)'}`,
    `Website: ${lead.website ?? '(null)'}`,
    `Evidence URL: ${lead.evidence_url}`,
    '',
    'Trả ĐÚNG một JSON object (không markdown):',
    JSON.stringify({
      verdict: 'confirm|deny|uncertain',
      confidence: 0.0,
      reason: 'short string',
    }),
    '',
    'Quy tắc:',
    '- confirm: công ty có vẻ tồn tại tại địa bàn VÀ (SĐT hoặc email) khớp nguồn tin cậy.',
    '- deny: công ty không tồn tại / sai địa bàn mạnh / contact rõ ràng sai.',
    '- uncertain: không đủ căn cứ.',
  ].join('\n');
}

export function parseCrossCheckResponse(raw: string): ParsedCrossCheck {
  const text = String(raw ?? '').trim();
  let obj: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      obj = parsed as Record<string, unknown>;
    }
  } catch {
    /* try extract */
  }
  if (!obj) {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      try {
        const parsed = JSON.parse(fence[1].trim()) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          obj = parsed as Record<string, unknown>;
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (!obj) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          obj = parsed as Record<string, unknown>;
        }
      } catch {
        /* ignore */
      }
    }
  }

  const verdictRaw = String(obj?.verdict ?? 'uncertain')
    .trim()
    .toLowerCase();
  const verdict: CrossCheckVerdict =
    verdictRaw === 'confirm' || verdictRaw === 'deny' || verdictRaw === 'uncertain'
      ? verdictRaw
      : 'uncertain';
  const conf = Number(obj?.confidence);
  return {
    verdict,
    confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0,
    reason: String(obj?.reason ?? '').slice(0, 400),
  };
}

/**
 * confirm → +15 (multi-source agree); deny (conf≥0.6) → hard reject;
 * soft deny → −35 score.
 */
export function applyCrossCheckToScore(
  score: number,
  parsed: ParsedCrossCheck,
): { score: number; forceReject: boolean; delta: number } {
  if (parsed.verdict === 'confirm') {
    const next = Math.min(100, score + 15);
    return { score: next, forceReject: false, delta: next - score };
  }
  if (parsed.verdict === 'deny') {
    if (parsed.confidence >= 0.6) {
      return { score: Math.max(0, score - 40), forceReject: true, delta: -40 };
    }
    const next = Math.max(0, score - 35);
    return { score: next, forceReject: false, delta: next - score };
  }
  return { score, forceReject: false, delta: 0 };
}
