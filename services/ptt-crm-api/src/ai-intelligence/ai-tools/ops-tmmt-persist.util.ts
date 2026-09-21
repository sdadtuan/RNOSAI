/** P8.4 — lifecycle TMMT is source of truth; empty plan snapshots must not drop cores. */

import {
  isGateSatisfyingStatus,
  resolveFieldStatus,
  type FieldQualityMeta,
} from './ops-field-quality.util';
import { WINNING_PLAN_CORE_KEYS } from './ops-winning-plan-gate.util';

export type TmmtPersistOverlay = {
  target_market_prof: Record<string, string>;
  strategy_framework: Record<string, string>;
  changed: boolean;
};

function textOf(value: unknown): string {
  return String(value ?? '').trim();
}

function readMetaMap(sf: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const raw = sf?.ai_tmmt_field_meta;
  if (!raw) return {};
  if (typeof raw === 'object') return { ...(raw as Record<string, unknown>) };
  try {
    const parsed = JSON.parse(String(raw));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...(parsed as Record<string, unknown>) };
    }
  } catch {
    return {};
  }
  return {};
}

function asStringRecord(raw: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (key === 'ai_tmmt_field_meta') continue;
    if (value != null && typeof value === 'object') out[key] = JSON.stringify(value);
    else out[key] = String(value ?? '');
  }
  return out;
}

/**
 * Fill empty lifecycle cores from confirm meta, Consult/BANT quality, or a richer
 * plan snapshot. Never replace a filled lifecycle value with an empty snapshot.
 */
export function overlayLifecycleTmmt(opts: {
  strategy_framework: Record<string, unknown>;
  target_market_prof: Record<string, unknown>;
  snapshot?: {
    strategy_framework?: Record<string, unknown>;
    target_market_prof?: Record<string, unknown>;
  } | null;
  consultPain?: FieldQualityMeta | null;
  consultIcp?: FieldQualityMeta | null;
  lifecycleId?: number | null;
}): TmmtPersistOverlay {
  const prof = asStringRecord(opts.target_market_prof);
  const sf = asStringRecord(opts.strategy_framework);
  const meta = readMetaMap(opts.strategy_framework);
  const snapProf = opts.snapshot?.target_market_prof ?? {};
  const snapMeta = readMetaMap(opts.snapshot?.strategy_framework);
  const snapSf = opts.snapshot?.strategy_framework ?? {};
  let changed = false;

  const consultByKey: Partial<Record<(typeof WINNING_PLAN_CORE_KEYS)[number], FieldQualityMeta | null | undefined>> =
    {
      pains_desired_outcomes: opts.consultPain,
      segmentation_icp: opts.consultIcp,
    };

  for (const key of WINNING_PLAN_CORE_KEYS) {
    const metaRow =
      meta[key] && typeof meta[key] === 'object'
        ? (meta[key] as Record<string, unknown>)
        : {};
    const currentText = textOf(prof[key]);
    const metaText = textOf(metaRow.text) || textOf(metaRow.value);
    const consult = consultByKey[key];
    const consultText = textOf(consult?.text) || textOf(consult?.value);
    const snapText = textOf(snapProf[key]);

    let text = currentText;
    if (!text && metaText) text = metaText;
    if (!text && consultText) text = consultText;
    if (!text && snapText) text = snapText;

    if (text && text !== currentText) {
      prof[key] = text;
      changed = true;
    }

    const resolved = resolveFieldStatus({ text, meta: meta[key] });
    const snapResolved =
      snapMeta[key] != null
        ? resolveFieldStatus({ text, meta: snapMeta[key] })
        : null;
    const donor =
      consult && text && text === consultText && isGateSatisfyingStatus(consult.status)
        ? consult
        : snapResolved && isGateSatisfyingStatus(snapResolved.status)
          ? snapResolved
          : null;

    let next = resolved;
    if (text && donor && isGateSatisfyingStatus(donor.status) && next.status !== donor.status) {
      next = { ...donor, text, status: donor.status };
    }
    if (isGateSatisfyingStatus(metaRow.status) && !isGateSatisfyingStatus(next.status)) {
      next = {
        ...resolved,
        status: String(metaRow.status) as FieldQualityMeta['status'],
        text,
      };
    }

    const filledGap = Boolean(text) && text !== currentText;
    const statusUpgraded =
      Boolean(text) &&
      isGateSatisfyingStatus(next.status) &&
      !isGateSatisfyingStatus(metaRow.status) &&
      (Boolean(donor) || filledGap);
    if (filledGap || statusUpgraded) {
      meta[key] = {
        ...next,
        text,
        value: text,
        lifecycle_id: opts.lifecycleId ?? next.lifecycle_id,
      };
      changed = true;
    }
  }

  for (const [key, value] of Object.entries(snapProf)) {
    if (!textOf(prof[key]) && textOf(value)) {
      prof[key] = String(value);
      changed = true;
    }
  }
  if (!textOf(sf.target_market) && textOf(snapSf.target_market)) {
    sf.target_market = String(snapSf.target_market);
    changed = true;
  }

  if (changed) {
    sf.ai_tmmt_field_meta = JSON.stringify(meta);
  } else if (opts.strategy_framework.ai_tmmt_field_meta != null) {
    const raw = opts.strategy_framework.ai_tmmt_field_meta;
    sf.ai_tmmt_field_meta = typeof raw === 'string' ? raw : JSON.stringify(raw);
  }

  return { target_market_prof: prof, strategy_framework: sf, changed };
}
