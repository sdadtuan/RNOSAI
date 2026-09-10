import { REAL_ESTATE_PACK } from '../kpi-hub/service-kpi/service-kpi-policy-pack';
import {
  evaluateLeadVideoFile,
  type LeadVideoFileFacts,
} from './ptt-fb-lead-video-qc.util';
import {
  evaluateQcChecks,
  QcCheckReport,
  QcFacts,
  QcReport,
  QcResult,
} from './cp-qc.service';
import { CpQcPackId } from './cp-playbook.types';

export type DomainQcFacts = QcFacts & {
  caption?: string | null;
  script_text?: string | null;
  banned_phrase?: string | null;
  project_id?: string | number | null;
  image_project_id?: string | number | null;
  has_claim?: boolean | null;
  legal_approved?: boolean | null;
  lead_video?: Partial<LeadVideoFileFacts> | null;
};

export type DomainQcReport = QcReport & {
  pack?: CpQcPackId;
  domain_checks?: Record<string, QcCheckReport>;
};

export function evaluateDomainQc(
  pack: CpQcPackId,
  facts: DomainQcFacts = {},
): DomainQcReport {
  const generic = evaluateQcChecks(facts);
  const domainChecks = domainChecksForPack(pack, facts);
  const overall = rollupQc([
    ...Object.values(generic.checks).map((item) => item.result),
    ...Object.values(domainChecks).map((item) => item.result),
  ]);
  return {
    ...generic,
    overall,
    pack,
    domain_checks: domainChecks,
  };
}

function domainChecksForPack(
  pack: CpQcPackId,
  facts: DomainQcFacts,
): Record<string, QcCheckReport> {
  switch (pack) {
    case 'bds_social':
      return bdsSocialChecks(facts);
    case 'lead_social':
      return leadSocialChecks(facts);
    case 'tvc_short':
      return tvcShortChecks(facts);
    default:
      return {};
  }
}

function bdsSocialChecks(facts: DomainQcFacts): Record<string, QcCheckReport> {
  const text = combinedText(facts);
  const banned = findBannedPhrase(text);
  const bannedPhrase = banned
    ? report('blocked', 'banned_phrase')
    : report('passed');
  const projectMatch = facts.project_id != null
    && facts.image_project_id != null
    && String(facts.project_id) !== String(facts.image_project_id)
    ? report('blocked', 'image_project_mismatch')
    : facts.project_id == null || facts.image_project_id == null
      ? report('warning', 'project_match_unknown')
      : report('passed');
  const priceWording = /(?:^|\s)từ(?:\s|$)/i.test(text) || /(?:^|\s)tu(?:\s|$)/i.test(text)
    ? report('passed')
    : report('warning', 'price_from_wording_missing');
  return {
    banned_phrase: bannedPhrase,
    project_image_match: projectMatch,
    price_from_wording: priceWording,
  };
}

function leadSocialChecks(facts: DomainQcFacts): Record<string, QcCheckReport> {
  const lead = facts.lead_video;
  if (!lead || typeof lead !== 'object') {
    return { lead_pack: report('warning', 'lead_facts_missing') };
  }
  const hookId = lead.hook_id ?? 'h1';
  const fileReport = evaluateLeadVideoFile({
    hook_id: hookId,
    filename: lead.filename ?? `ptt-lead-${hookId}-15.mp4`,
    width: Number(lead.width ?? facts.width ?? 0),
    height: Number(lead.height ?? facts.height ?? 0),
    duration_sec: Number(lead.duration_sec ?? facts.duration_sec ?? 0),
    has_audio: lead.has_audio ?? facts.has_audio ?? false,
    face_sec: Number(lead.face_sec ?? 0),
    face_id: String(lead.face_id ?? ''),
    founder_claim: Boolean(lead.founder_claim),
    ui_shot: Boolean(lead.ui_shot),
    caption_has_spaces: Boolean(lead.caption_has_spaces),
    caption_top_third: Boolean(lead.caption_top_third),
    safe_top_px: Number(lead.safe_top_px ?? 0),
    safe_bottom_px: Number(lead.safe_bottom_px ?? 0),
    logo_present: Boolean(lead.logo_present ?? facts.logo_present),
    cta_is_form: Boolean(lead.cta_is_form),
    cta_is_call_only: Boolean(lead.cta_is_call_only),
    ai_label_on_creative: Boolean(lead.ai_label_on_creative),
    fake_cpl_claim: Boolean(lead.fake_cpl_claim),
    contains_human: Boolean(lead.contains_human),
    ai_disclosure: Boolean(lead.ai_disclosure),
    primary_text: String(lead.primary_text ?? facts.caption ?? ''),
  });
  const mapped: Record<string, QcCheckReport> = {};
  for (const [key, value] of Object.entries(fileReport.checks)) {
    mapped[`lead_${key}`] = {
      result: value.result === 'blocked' ? 'blocked' : 'passed',
      reason: value.reason,
    };
  }
  mapped.lead_overall = {
    result: fileReport.overall,
    reason: fileReport.overall === 'blocked' ? 'lead_pack_blocked' : null,
  };
  return mapped;
}

function tvcShortChecks(facts: DomainQcFacts): Record<string, QcCheckReport> {
  const hasClaim = facts.has_claim === true;
  const legal = hasClaim && facts.legal_approved !== true
    ? report('blocked', 'legal_not_approved')
    : hasClaim
      ? report('passed')
      : report('warning', 'claim_unknown');
  const introOutro = facts.logo_present === true
    ? report('passed')
    : facts.logo_present === false
      ? report('blocked', 'brand_logo_missing')
      : report('warning', 'brand_logo_unknown');
  return {
    legal_claim: legal,
    brand_intro_outro: introOutro,
  };
}

function combinedText(facts: DomainQcFacts): string {
  return [
    facts.caption,
    facts.script_text,
    facts.banned_phrase,
  ].filter(Boolean).join(' ');
}

function findBannedPhrase(text: string): string | null {
  const normalized = text.normalize('NFC').toLowerCase();
  for (const phrase of REAL_ESTATE_PACK.banned_phrases) {
    if (normalized.includes(phrase.normalize('NFC').toLowerCase())) {
      return phrase;
    }
  }
  return null;
}

function rollupQc(results: QcResult[]): QcResult {
  if (results.includes('blocked')) return 'blocked';
  if (results.includes('warning')) return 'warning';
  return 'passed';
}

function report(result: QcResult, reason: string | null = null): QcCheckReport {
  return { result, reason };
}
