import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { kanbanCardSettingsFromPayload } from '../leads/kanban-card.util';
import { LeadSlaSettingsService } from '../lead-sla-settings/lead-sla-settings.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import type { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import {
  alertPeriodKey,
  buildAeAlertCandidates,
  inKanbanShift,
  planAeTeamAlertTick,
} from './ae-team-alerts.util';
import { AeTeamRepository, type AeLeadRow } from './ae-team.repository';
import {
  aeTeamSettingsFromPayload,
  buildAeMemberStats,
  leadNeed,
  resolveAeTeamPeriod,
  scopeFromAccess,
  type AeTeamLeadFact,
} from './ae-team.util';

@Injectable()
export class AeTeamAlertsService {
  private lastTickAt = 0;

  constructor(
    private readonly repo: AeTeamRepository,
    private readonly settings: LeadSlaSettingsService,
    private readonly staffAuth: StaffAuthService,
    private readonly notifications: StaffNotificationsRepository,
  ) {}

  async list(actor: StaffJwtPayload) {
    const ownerIds = await this.ownerIds(actor);
    const items = await this.repo.listOpenAlerts(ownerIds);
    return { items };
  }

  async acknowledge(actor: StaffJwtPayload, id: number) {
    const alert = await this.editableAlert(actor, id);
    if (alert.status !== 'open') {
      return { id, status: alert.status };
    }
    await this.repo.acknowledgeAlert(id);
    return { id, status: 'acknowledged' };
  }

  async resolve(actor: StaffJwtPayload, id: number) {
    await this.editableAlert(actor, id);
    await this.repo.resolveAlerts([id], actor.email);
    return { id, status: 'resolved' };
  }

  async tick(now = new Date(), actor?: StaffJwtPayload, force = false) {
    if (actor) await this.ownerIds(actor);
    const payload = await this.settings.getPublishedPayload();
    const kanban = kanbanCardSettingsFromPayload(payload);
    const thresholds = aeTeamSettingsFromPayload(payload);
    if (!force && now.getTime() - this.lastTickAt < thresholds.alert_interval_minutes * 60_000) {
      return { inserted: 0, escalated: 0, resolved: 0, skipped: 'interval' };
    }
    if (!inKanbanShift(now, kanban)) {
      return { inserted: 0, escalated: 0, resolved: 0, skipped: 'outside_hours' };
    }
    const members = await this.repo.listMembers({ viewAll: true, teamIds: [], month: monthKey(now) });
    const ownerIds = members.map((member) => member.staff_id);
    const leads = await this.repo.listLeads(ownerIds);
    const thisWeek = resolveAeTeamPeriod('week', undefined, undefined, now);
    const lastFrom = new Date(thisWeek.from.getTime() - 7 * 86_400_000);
    const calls = await this.repo.listCalls(ownerIds, lastFrom, thisWeek.to);
    const facts = members.map((member) => {
      const owned = leads.filter((lead) => lead.owner_id === member.staff_id).map(fact);
      const currentCalls = calls.filter((call) => call.owner_id === member.staff_id && new Date(call.at) >= thisWeek.from);
      const previousCalls = calls.filter((call) => call.owner_id === member.staff_id && new Date(call.at) < thisWeek.from);
      const current = buildAeMemberStats({
        leads: owned, calls: currentCalls, kanban, thresholds, now, period: thisWeek, quotaVnd: null,
      });
      const previous = buildAeMemberStats({
        leads: owned,
        calls: previousCalls,
        kanban,
        thresholds,
        now,
        period: { from: lastFrom, to: new Date(thisWeek.from.getTime() - 1000) },
        quotaVnd: null,
      });
      const lastCall = owned
        .map((lead) => lead.lastCallAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;
      return {
        staffId: member.staff_id,
        slaBreach: current.sla_breach,
        answerPct: current.answer_pct,
        winPct: current.quote_to_won_pct,
        prevAnswerPct: previous.answer_pct,
        prevWinPct: previous.quote_to_won_pct,
        lastCallAt: lastCall,
        owned,
      };
    });
    const periodKey = alertPeriodKey(now);
    const candidates = buildAeAlertCandidates({
      now,
      periodKey,
      weekKey: alertPeriodKey(thisWeek.from),
      thresholds,
      kanban,
      members: facts,
      leads: facts.flatMap((member) => member.owned.map((lead) => ({ ownerId: member.staffId, lead }))),
    });
    const since = new Date(now.getTime() - thresholds.alert_cooldown_minutes * 60_000);
    const existing = await this.repo.listAlertsForTick(since);
    const plan = planAeTeamAlertTick({
      inShift: true,
      now,
      cooldownMinutes: thresholds.alert_cooldown_minutes,
      escalateMinutes: thresholds.escalate_minutes,
      periodKey,
      candidates,
      existing,
    });
    const leaders = await this.repo.teamLeadUserIds(ownerIds);
    const managers = await this.repo.viewAllUserIds();
    let inserted = 0;
    for (const row of plan.insert) {
      const id = await this.repo.insertAlert({
        ruleCode: row.ruleCode,
        targetType: row.targetType,
        targetId: row.targetId,
        level: row.level,
        ownerStaffId: row.ownerStaffId,
        dedupeKey: row.dedupeKey,
      });
      if (id == null) continue;
      inserted += 1;
      const users = row.ruleCode === 'HOT-AE'
        ? [await this.repo.staffUserId(row.ownerStaffId)].filter((userId): userId is string => Boolean(userId))
        : [...(leaders.get(row.ownerStaffId) ?? []), ...(row.ruleCode === 'ESC' ? managers : [])];
      await this.bell([...new Set(users)], row.title, row.body);
    }
    for (const change of plan.escalate) {
      await this.repo.setAlertLevel(change.id, change.level);
    }
    await this.repo.resolveAlerts(plan.resolveIds, 'system');
    this.lastTickAt = now.getTime();
    return { inserted, escalated: plan.escalate.length, resolved: plan.resolveIds.length, skipped: null };
  }

  private async editableAlert(actor: StaffJwtPayload, id: number) {
    const alert = await this.repo.getAlert(id);
    if (!alert) {
      throw new NotFoundException({ ok: false, error: { code: 'alert_not_found', message: 'Không thấy cảnh báo.' } });
    }
    const ownerIds = await this.ownerIds(actor);
    if (!ownerIds.includes(alert.ownerStaffId)) throw this.denied();
    return alert;
  }

  private async ownerIds(actor: StaffJwtPayload): Promise<number[]> {
    await this.repo.ensure();
    const me = await this.staffAuth.me(actor);
    const viewAll = me.caps.some((cap) => cap.section === 'crm_ae_team' && cap.action === 'view_all');
    const teamIds = viewAll ? [] : await this.repo.leadTeamIds(actor.sub);
    const scope = scopeFromAccess(viewAll, teamIds);
    if (scope.mode === 'deny') throw this.denied();
    const members = await this.repo.listMembers({
      viewAll: scope.mode === 'all',
      teamIds: scope.mode === 'teams' ? scope.teamIds : [],
      month: monthKey(new Date()),
    });
    return members.map((member) => member.staff_id);
  }

  private async bell(userIds: string[], title: string, body: string) {
    for (const userId of userIds) {
      await this.notifications.create({
        user_id: userId,
        kind: 'ae_team_alert',
        title,
        body,
        link_href: '/crm/b2b/team',
      }).catch(() => undefined);
    }
  }

  private denied(): ForbiddenException {
    return new ForbiddenException({
      ok: false,
      error: { code: 'ae_team_forbidden', message: 'Bạn không có quyền xem đội AE này.' },
    });
  }
}

function monthKey(date: Date): string {
  const local = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  return `${local.getUTCFullYear()}-${month}`;
}

function fact(row: AeLeadRow): AeTeamLeadFact {
  let value: number | null = null;
  for (const key of ['deal_value_vnd', 'expected_value']) {
    const parsed = Number(row.meta_json[key]);
    if (Number.isFinite(parsed) && parsed > 0) {
      value = Math.round(parsed);
      break;
    }
  }
  return {
    id: row.id,
    status: row.status,
    receivedAt: row.received_at ?? row.created_at,
    updatedAt: row.updated_at,
    firstCallAt: row.first_call_at,
    lastCallAt: row.last_call_at,
    nextCallAt: row.next_call_at,
    hasCall: Boolean(row.last_call_at || row.first_call_at),
    source: row.source,
    channel: row.channel,
    need: leadNeed(row.meta_json),
    valueVnd: value,
    callAttemptCount: row.call_attempt_count,
    lastCallResult: row.last_call_result,
  };
}
