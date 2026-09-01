export function towerDrillHref(args: {
  factory: 'A' | 'B';
  columnId: string;
  sensorIds: string[];
  leadId?: number;
  lifecycleId?: number;
  clientUuid?: string;
}): string {
  if (args.factory === 'B') {
    const lead = args.leadId != null ? `?lead_id=${args.leadId}` : '?sla=first_call_15m';
    return `/crm/cskh-board${lead}`;
  }
  if (args.sensorIds.includes('S5') && args.lifecycleId) {
    return `/crm/service-delivery/${args.lifecycleId}?tab=ai-planner`;
  }
  if (args.sensorIds.includes('S6') && args.lifecycleId) {
    return `/crm/service-delivery/${args.lifecycleId}?tab=launch-qa`;
  }
  if ((args.sensorIds.includes('S7') || args.sensorIds.includes('S10')) && args.lifecycleId) {
    return `/crm/service-delivery/${args.lifecycleId}?tab=ops-hub`;
  }
  if (args.sensorIds.includes('S8') && args.clientUuid) {
    return `/agency/clients/${args.clientUuid}`;
  }
  if (args.columnId === 'contract') {
    return args.leadId ? `/crm/leads/${args.leadId}#lead-contract` : '/crm/hub';
  }
  if (args.lifecycleId && (args.columnId === 'tmmt_deliver' || args.columnId === 'care')) {
    return `/crm/service-delivery/${args.lifecycleId}`;
  }
  if (args.leadId) return `/crm/leads/${args.leadId}`;
  return '/crm/leads';
}
