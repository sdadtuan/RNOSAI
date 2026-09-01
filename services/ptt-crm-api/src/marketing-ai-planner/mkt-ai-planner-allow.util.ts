import { ForbiddenException, NotFoundException } from '@nestjs/common';

export type PlannerPolicySnap = { rollout: 'off' | 'pilot' | 'ga'; enabled: boolean };

export type PlannerAllowEnv = {
  plannerEnabled: boolean;
  envSlugs: string[];
  pilotOnly: boolean;
  pilotSlugs: string[];
};

export type PlannerAllowResult =
  | { ok: true }
  | { ok: false; error: string; message: string; admin_path: string; service_slug: string };

export function adminPlaybooksPath(slug: string): string {
  return `/crm/admin/mkt-ai/playbooks?slug=${encodeURIComponent(slug)}`;
}

export function assertPlannerAllowed(
  serviceSlug: string,
  policy: PlannerPolicySnap | null,
  env: PlannerAllowEnv,
): PlannerAllowResult {
  const slug = String(serviceSlug ?? '').trim();
  const fail = (error: string, message: string): PlannerAllowResult => ({
    ok: false,
    error,
    message,
    admin_path: adminPlaybooksPath(slug),
    service_slug: slug,
  });

  if (!env.plannerEnabled) {
    return fail('mkt_ai_planner_disabled', 'AI Marketing Planner đang tắt.');
  }
  if (!slug) return fail('mkt_ai_service_not_enabled', 'Thiếu service_slug.');

  if (policy) {
    if (!policy.enabled || policy.rollout === 'off') {
      return fail(
        'mkt_ai_service_not_enabled',
        'Dịch vụ này chưa mở AI Planner. MKT Lead bật pilot tại Admin → AI Marketing → Playbooks.',
      );
    }
  } else if (env.envSlugs.length === 0 && !env.pilotOnly) {
    return fail(
      'mkt_ai_service_not_enabled',
      'Dịch vụ này chưa mở AI Planner. MKT Lead bật pilot tại Admin → AI Marketing → Playbooks.',
    );
  } else if (!policy) {
    const inEnv = !env.envSlugs.length || env.envSlugs.includes(slug);
    const inPilot = !env.pilotOnly || env.pilotSlugs.includes(slug);
    if (!inEnv || !inPilot) {
      return fail(
        'mkt_ai_service_not_enabled',
        'Dịch vụ này chưa mở AI Planner. MKT Lead bật pilot tại Admin → AI Marketing → Playbooks.',
      );
    }
    return { ok: true };
  }

  if (env.envSlugs.length && !env.envSlugs.includes(slug)) {
    return fail(
      'mkt_ai_service_not_enabled',
      'Dịch vụ này chưa mở AI Planner. MKT Lead bật pilot tại Admin → AI Marketing → Playbooks.',
    );
  }
  if (env.pilotOnly && env.pilotSlugs.length && !env.pilotSlugs.includes(slug)) {
    return fail(
      'mkt_ai_service_not_enabled',
      'Dịch vụ này chưa mở AI Planner. MKT Lead bật pilot tại Admin → AI Marketing → Playbooks.',
    );
  }
  return { ok: true };
}

export function throwPlannerAllowResult(allowed: PlannerAllowResult): void {
  if (allowed.ok) return;
  if (allowed.error === 'mkt_ai_planner_disabled') {
    throw new NotFoundException({ error: allowed.error, message: allowed.message });
  }
  throw new ForbiddenException({
    error: allowed.error,
    message: allowed.message,
    admin_path: allowed.admin_path,
    service_slug: allowed.service_slug,
  });
}
