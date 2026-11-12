import { Injectable } from '@nestjs/common';
import {
  planLeadArrivalAlerts,
  type AlertKind,
  type AlertReceiver,
  type AlertSeverity,
} from './b2b-alert.util';
import { B2bAlertsRepository } from './b2b-alerts.repository';
import { B2bStaffPushSender } from './b2b-staff-push.sender';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import { caseStaffNotify } from '../leads-funnel/case-staff-notify.util';
import type { B2bLeadScopeRow } from './b2b-visibility.util';

function alertTitle(kind: AlertKind, score: number | null): string {
  if (kind === 'assigned_hot') return `Lead Hot mới${score != null ? ` (${Math.round(score)})` : ''}`;
  if (kind === 'assigned') return 'Lead mới được gán';
  if (kind === 'unassigned') return 'Lead mới chờ nhận';
  return 'Lead B2B';
}

@Injectable()
export class B2bAlertsService {
  constructor(
    private readonly repo: B2bAlertsRepository,
    private readonly push: B2bStaffPushSender,
    private readonly notifications: StaffNotificationsRepository,
  ) {}

  async fanoutArrival(input: {
    lead: B2bLeadScopeRow & { score: number | null; leadId: number };
    inHours: boolean;
    receivers: AlertReceiver[];
  }): Promise<void> {
    const planned = planLeadArrivalAlerts({
      lead: input.lead,
      inHours: input.inHours,
      receivers: input.receivers,
    });
    await this.repo.insertAlerts(
      planned.map((p) => ({
        leadId: input.lead.leadId,
        staffId: p.staffId,
        severity: p.severity,
        kind: p.kind,
      })),
    );
    for (const p of planned) {
      if (p.kind === 'assigned' || p.kind === 'assigned_hot') {
        const payload = caseStaffNotify({ kind: 'lead_assigned', leadId: input.lead.leadId });
        await this.notifications.notifyStaff(p.staffId, payload);
      }
      await this.push.send({
        staffId: p.staffId,
        title: alertTitle(p.kind, input.lead.score),
        severity: p.severity as AlertSeverity,
        leadId: input.lead.leadId,
      });
    }
  }

  listInbox(input: { staffId?: number; scopeAll: boolean; limit?: number }) {
    return this.repo.listAlerts({
      staffId: input.scopeAll ? undefined : input.staffId,
      limit: input.limit,
    });
  }
}
