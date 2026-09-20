/** P8 — load/save Pain/ICP/Service quality bundle from lead+consult task form_data. */

import {
  normalizeFieldMeta,
  resolveFieldStatus,
  type FieldQualityMeta,
  type FieldQualityStatus,
} from './ops-field-quality.util';
import { parseServiceStatus, type ServiceStatus } from './ops-consult-ready.util';
import type { P8QualityBundle } from './ops-presales-p8.types';

export function readP8QualityFromForms(opts: {
  leadForm?: Record<string, unknown> | null;
  consultForm?: Record<string, unknown> | null;
  intakeMeta?: Record<string, unknown> | null;
}): P8QualityBundle {
  const lead = opts.leadForm ?? {};
  const consult = opts.consultForm ?? {};
  const intakeMeta = opts.intakeMeta ?? {};
  const quality =
    (consult.p8_quality as Record<string, unknown> | undefined) ??
    (lead.p8_quality as Record<string, unknown> | undefined) ??
    {};

  const painText =
    String((quality.need_pain as FieldQualityMeta | undefined)?.text ?? '').trim() ||
    String(intakeMeta.pain_summary ?? '').trim() ||
    String(lead.need ?? '').trim() ||
    String(consult.current_status ?? '').trim();
  const painMeta =
    quality.need_pain ??
    intakeMeta.pain_quality ??
    lead.pain_quality ??
    consult.pain_quality;

  const icpText =
    String((quality.icp as FieldQualityMeta | undefined)?.text ?? '').trim() ||
    String(consult.target_audience ?? '').trim() ||
    String(lead.niche ?? lead.industry ?? '').trim();
  const icpMeta = quality.icp ?? consult.icp_quality ?? lead.icp_quality;

  const serviceStatus = parseServiceStatus(
    quality.service_status ?? consult.service_status ?? lead.service_status,
  );

  return {
    need_pain: resolveFieldStatus({ text: painText, meta: painMeta }),
    icp: resolveFieldStatus({ text: icpText, meta: icpMeta }),
    service_status: serviceStatus,
    service_recommendation:
      consult.service_recommendation ?? lead.service_recommendation ?? quality.service_recommendation,
    needs_am_rework: Boolean(consult.needs_am_rework ?? lead.needs_am_rework ?? quality.needs_am_rework),
    return_to_am_blockers: Array.isArray(consult.return_to_am_blockers)
      ? (consult.return_to_am_blockers as string[])
      : Array.isArray(lead.return_to_am_blockers)
        ? (lead.return_to_am_blockers as string[])
        : [],
  };
}

export function writeP8QualityPatch(opts: {
  form: Record<string, unknown>;
  need_pain?: FieldQualityMeta;
  icp?: FieldQualityMeta;
  service_status?: ServiceStatus;
  service_recommendation?: unknown;
  needs_am_rework?: boolean;
  return_to_am_blockers?: string[];
  clear_rework?: boolean;
}): Record<string, unknown> {
  const next = { ...opts.form };
  const prevQuality =
    next.p8_quality && typeof next.p8_quality === 'object'
      ? ({ ...(next.p8_quality as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  if (opts.need_pain) {
    prevQuality.need_pain = normalizeFieldMeta(opts.need_pain);
    if (opts.need_pain.text) {
      next.need = opts.need_pain.text;
      if (!String(next.current_status ?? '').trim()) {
        next.current_status = `Pain: ${opts.need_pain.text}`.slice(0, 4000);
      }
    }
  }
  if (opts.icp) {
    prevQuality.icp = normalizeFieldMeta(opts.icp);
    if (opts.icp.text) {
      next.target_audience = opts.icp.text;
      if (!String(next.niche ?? '').trim()) next.niche = opts.icp.text.slice(0, 400);
    }
  }
  if (opts.service_status) {
    prevQuality.service_status = opts.service_status;
    next.service_status = opts.service_status;
  }
  if (opts.service_recommendation !== undefined) {
    prevQuality.service_recommendation = opts.service_recommendation;
    next.service_recommendation = opts.service_recommendation;
  }
  if (opts.needs_am_rework != null) {
    prevQuality.needs_am_rework = opts.needs_am_rework;
    next.needs_am_rework = opts.needs_am_rework;
  }
  if (opts.clear_rework) {
    prevQuality.needs_am_rework = false;
    next.needs_am_rework = false;
    next.return_to_am_blockers = [];
    prevQuality.return_to_am_blockers = [];
  }
  if (opts.return_to_am_blockers) {
    prevQuality.return_to_am_blockers = opts.return_to_am_blockers;
    next.return_to_am_blockers = opts.return_to_am_blockers;
  }

  next.p8_quality = prevQuality;
  return next;
}

export function confirmFieldMeta(
  current: FieldQualityMeta,
  nextStatus: Extract<FieldQualityStatus, 'assumed_confirmed' | 'validated' | 'empty'>,
  actor: string,
): FieldQualityMeta {
  if (nextStatus === 'empty') {
    return {
      status: 'empty',
      source: current.source,
      text: '',
      confirmed_by: actor,
      confirmed_at: new Date().toISOString(),
    };
  }
  return {
    ...current,
    status: nextStatus,
    confirmed_by: actor,
    confirmed_at: new Date().toISOString(),
  };
}
