import { Injectable } from '@nestjs/common';
import { resolveLeadFlowKind } from '../leads-funnel/lead-flow-kind.util';
import {
  companyHintFromEmailDomain,
  normalizeWebsiteUrl,
} from './lmp-tier1-hints.util';
import type { LeadMeetingPrepInput, LeadPrepContextRow } from './lead-meeting-prep.types';

function pickString(meta: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = meta[key];
    if (val !== undefined && val !== null && String(val).trim()) {
      return String(val).trim();
    }
  }
  return '';
}

export interface ResolvedPrepInput {
  input: LeadMeetingPrepInput;
  sources_map: Record<string, string>;
  /** Hard block — missing phone and email. */
  skip_reason?: 'missing_contact';
  /** Soft block — pipeline/UI waits for AM to supply company. */
  needs_am_input?: 'missing_company_name';
}

@Injectable()
export class LeadMeetingPrepInputResolver {
  resolve(row: LeadPrepContextRow): ResolvedPrepInput {
    const meta = row.meta_json ?? {};
    const sources: Record<string, string> = {};

    const fullName = String(row.full_name ?? '').trim();
    const phone = String(row.phone ?? '').trim();
    const email = String(row.email ?? '').trim().toLowerCase();

    const formData =
      typeof meta.form_data === 'object' && meta.form_data !== null
        ? (meta.form_data as Record<string, unknown>)
        : {};

    let companyName =
      pickString(meta, 'company_name', 'company', 'business_name', 'page_name') ||
      pickString(formData, 'company_name', 'company', 'business_name', 'ten_cong_ty', 'cong_ty');
    if (companyName) {
      sources.company_name = pickString(meta, 'company_name', 'company')
        ? 'meta_json'
        : 'form_data';
    }

    const industry = pickString(meta, 'industry', 'industry_slug');
    if (industry) sources.industry = 'meta_json';

    const marketingBudget = pickString(meta, 'budget', 'marketing_budget');
    const budgetFromForm = pickString(formData, 'budget');
    const budget = marketingBudget || budgetFromForm;

    const problem =
      pickString(meta, 'notes', 'need', 'problem') || pickString(formData, 'need');

    let websiteUrl =
      pickString(meta, 'website_url', 'domain', 'website') ||
      pickString(formData, 'website_url', 'website', 'domain', 'trang_web');
    if (websiteUrl) {
      sources.website_url = pickString(meta, 'website_url', 'domain', 'website')
        ? 'meta_json'
        : 'form_data';
      websiteUrl = normalizeWebsiteUrl(websiteUrl);
    }

    if ((!companyName || companyName.length < 2) && email) {
      const hints = companyHintFromEmailDomain(email);
      if (hints.company_name && !companyName) {
        companyName = hints.company_name;
        sources.company_name = 'email_domain';
      }
      if (hints.website_url && !websiteUrl) {
        websiteUrl = hints.website_url;
        sources.website_url = 'email_domain';
      }
    }

    const socialUrls = pickString(meta, 'social_urls', 'facebook_page_url', 'page_url');

    const input: LeadMeetingPrepInput = {
      lead_id: row.lead_id,
      full_name: fullName,
      phone,
      email,
      company_name: companyName,
      industry,
      marketing_budget: budget,
      problem,
      website_url: websiteUrl || undefined,
      social_urls: socialUrls || undefined,
      client_id: row.client_id,
      channel: row.channel,
      source: row.source,
    };

    if (!phone && !email) {
      return { input, sources_map: sources, skip_reason: 'missing_contact' };
    }

    const needsAmInput =
      !companyName || companyName.length < 2 ? ('missing_company_name' as const) : undefined;

    return { input, sources_map: sources, needs_am_input: needsAmInput };
  }

  isEligibleForAutoEnqueue(
    row: LeadPrepContextRow,
    opts: { pilotClientIds: string[]; pilotOnly?: boolean },
  ): string | null {
    return this.isEligibleForEnqueue(row, opts, { requireInputFields: true });
  }

  /** M2/M3/M4 — lighter gate; GA skips pilot list when pilotOnly=false. */
  isEligibleForEnqueue(
    row: LeadPrepContextRow,
    opts: { pilotClientIds: string[]; pilotOnly?: boolean },
    gate: { requireInputFields?: boolean } = {},
  ): string | null {
    if (row.is_duplicate) return 'duplicate_lead';

    const flowKind = resolveLeadFlowKind({
      clientId: row.client_id,
      channel: row.channel,
      source: row.source,
      status: row.status,
      metaJson: row.meta_json,
      hasPresales: false,
    });
    if (flowKind === 'spa_operational') return 'spa_operational';

    const pilotOnly = opts.pilotOnly !== false;
    const clientId = String(row.client_id ?? '').trim().toLowerCase();
    if (pilotOnly && opts.pilotClientIds.length > 0) {
      if (!clientId || !opts.pilotClientIds.includes(clientId)) {
        return 'pilot_client_mismatch';
      }
    }

    if (gate.requireInputFields) {
      const resolved = this.resolve(row);
      return resolved.skip_reason ?? null;
    }
    return null;
  }
}
