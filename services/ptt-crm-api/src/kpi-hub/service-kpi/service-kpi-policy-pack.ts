import type { SkpiClassification } from './service-kpi-classification';

export type PolicyPackRule = {
  forbid_classification?: SkpiClassification;
  kpi_kind?: string;
  classification?: SkpiClassification;
  require?: string[];
};

export type PolicyPack = {
  industry: string;
  regulated: boolean;
  banned_phrases: string[];
  rules: PolicyPackRule[];
};

export type PolicyViolation = { code: string; field: string; message: string };

export const REAL_ESTATE_PACK: PolicyPack = {
  industry: 'real_estate',
  regulated: true,
  banned_phrases: ['cam kết doanh số', 'đảm bảo lead', 'chắc chắn x lead'],
  rules: [
    { forbid_classification: 'COMMITTED_DELIVERABLE', kpi_kind: 'booking_or_gmv' },
    { classification: 'BUSINESS_OUTCOME', require: ['attribution', 'client_sales_sla', 'disclaimer'] },
  ],
};

function normalizeText(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function evaluatePolicyPack(input: {
  pack: PolicyPack;
  classification: SkpiClassification;
  kpiKind?: string;
  proposalText?: string;
  hasAttribution?: boolean;
  hasClientSalesSla?: boolean;
  hasDisclaimer?: boolean;
}): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const kpiKind = String(input.kpiKind ?? '').toLowerCase();

  for (const rule of input.pack.rules) {
    if (
      rule.forbid_classification &&
      rule.kpi_kind &&
      input.classification === rule.forbid_classification &&
      kpiKind === rule.kpi_kind.toLowerCase()
    ) {
      violations.push({
        code: 'PACK_FORBIDDEN_CLASSIFICATION',
        field: 'classification',
        message: `${rule.forbid_classification} không được dùng cho ${rule.kpi_kind}`,
      });
    }

    if (rule.classification && input.classification === rule.classification && rule.require?.length) {
      const reqs = rule.require;
      if (reqs.includes('attribution') && !input.hasAttribution) {
        violations.push({
          code: 'PACK_REQUIRE_ATTRIBUTION',
          field: 'attribution',
          message: 'BUSINESS_OUTCOME yêu cầu attribution',
        });
      }
      if (reqs.includes('client_sales_sla') && !input.hasClientSalesSla) {
        violations.push({
          code: 'PACK_REQUIRE_CLIENT_SALES_SLA',
          field: 'client_sales_sla',
          message: 'BUSINESS_OUTCOME yêu cầu client sales SLA',
        });
      }
      if (reqs.includes('disclaimer') && !input.hasDisclaimer) {
        violations.push({
          code: 'PACK_REQUIRE_DISCLAIMER',
          field: 'disclaimer',
          message: 'BUSINESS_OUTCOME yêu cầu disclaimer',
        });
      }
    }
  }

  const text = normalizeText(input.proposalText ?? '');
  if (text) {
    for (const phrase of input.pack.banned_phrases) {
      if (text.includes(normalizeText(phrase))) {
        violations.push({
          code: 'PACK_BANNED_PHRASE',
          field: 'proposal_text',
          message: `Chứa từ cấm: ${phrase}`,
        });
        break;
      }
    }
  }

  return violations;
}
