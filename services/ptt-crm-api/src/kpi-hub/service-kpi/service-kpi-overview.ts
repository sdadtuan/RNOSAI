export type ServiceKpiOverviewInput = {
  templates_active: number;
  instances_total: number;
  instances_tracking: number;
  instances_with_plan: number;
  readiness_warning: number;
  readiness_blocking: number;
  at_risk: number;
  at_risk_critical: number;
};

export type ServiceKpiOverviewResponse = {
  templates_active: number;
  instances_tracking: number;
  instances_tracking_pct: number;
  readiness_warning: number;
  readiness_blocking: number;
  at_risk: number;
  at_risk_critical: number;
};

export function buildServiceKpiOverview(input: ServiceKpiOverviewInput): ServiceKpiOverviewResponse {
  const pct =
    input.instances_total > 0
      ? Math.round((input.instances_with_plan / input.instances_total) * 1000) / 10
      : 0;
  return {
    templates_active: input.templates_active,
    instances_tracking: input.instances_tracking,
    instances_tracking_pct: pct,
    readiness_warning: input.readiness_warning,
    readiness_blocking: input.readiness_blocking,
    at_risk: input.at_risk,
    at_risk_critical: input.at_risk_critical,
  };
}
