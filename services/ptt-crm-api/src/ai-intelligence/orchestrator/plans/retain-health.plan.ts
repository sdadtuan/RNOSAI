import type { OrchestrationPlan } from '../orchestrator.types';

export const RETAIN_HEALTH_PLAN = {
  key: 'retain_health_v1',
  steps: [
    { key: 'renewal_scan', required: true },
    { key: 'upsell_suggest', required: false },
    { key: 'channel_anomaly', required: false },
  ],
} as const satisfies OrchestrationPlan;
