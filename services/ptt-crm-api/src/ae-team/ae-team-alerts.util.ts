import { isWithinWorkingHours, workingHoursBetween } from '../lead-sla-settings/lead-sla-working-hours.util';
import type { KanbanCardSettings } from '../leads/kanban-card.util';
import { hotUncalledAlert, type AeTeamLeadFact, type AeTeamThresholds } from './ae-team.util';

export type AeAlertLevel = 'info' | 'yellow' | 'red' | 'esc';
export type AeAlertStatus = 'open' | 'acknowledged' | 'resolved';

export interface AeAlertCandidate {
  ruleCode: string;
  targetType: 'staff' | 'lead' | 'alert';
  targetId: string;
  level: AeAlertLevel;
  ownerStaffId: number;
  dedupeKey: string;
  title: string;
  body: string;
}

export interface AeStoredAlert {
  id: number;
  ruleCode: string;
  level: AeAlertLevel;
  status: AeAlertStatus;
  dedupeKey: string;
  createdAt: string;
  ownerStaffId: number;
  targetType: string;
  targetId: string;
}

export interface AeAlertTickPlan {
  insert: AeAlertCandidate[];
  escalate: Array<{ id: number; level: 'red' | 'esc' }>;
  resolveIds: number[];
}

export function inKanbanShift(now: Date, kanban: KanbanCardSettings): boolean {
  return isWithinWorkingHours(now, kanban.working_hours, kanban.holidays);
}

export function slaAlertLevel(breachCount: number, thresholds: AeTeamThresholds): 'yellow' | 'red' | null {
  if (breachCount < thresholds.ae_sla_breach_alert) return null;
  return breachCount >= thresholds.ae_sla_breach_red ? 'red' : 'yellow';
}

export function isAlertDrop(previous: number | null, current: number | null, dropPercent: number): boolean {
  if (previous == null || current == null) return false;
  return previous - current > dropPercent;
}

export function isAeIdle(lastCallAt: Date | null, now: Date, idleHours: number, kanban: KanbanCardSettings): boolean {
  if (!lastCallAt) return true;
  return workingHoursBetween(lastCallAt, now, kanban.working_hours, kanban.holidays) >= idleHours;
}

export function alertPeriodKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

export function buildAeAlertCandidates(input: {
  now: Date;
  periodKey: string;
  weekKey: string;
  thresholds: AeTeamThresholds;
  kanban: KanbanCardSettings;
  members: Array<{
    staffId: number;
    slaBreach: number;
    answerPct: number | null;
    winPct: number | null;
    prevAnswerPct: number | null;
    prevWinPct: number | null;
    lastCallAt: string | null;
  }>;
  leads: Array<{ ownerId: number; lead: AeTeamLeadFact }>;
}): AeAlertCandidate[] {
  const rows: AeAlertCandidate[] = [];
  for (const member of input.members) {
    const sla = slaAlertLevel(member.slaBreach, input.thresholds);
    if (sla) {
      rows.push(candidate({
        ruleCode: 'AE-SLA',
        targetType: 'staff',
        targetId: String(member.staffId),
        level: sla,
        ownerStaffId: member.staffId,
        period: input.periodKey,
        title: 'AE trễ SLA',
        body: `${member.slaBreach} lead trễ liên hệ lần đầu`,
      }));
    }
    const last = member.lastCallAt ? new Date(member.lastCallAt) : null;
    if (isAeIdle(last && !Number.isNaN(last.getTime()) ? last : null, input.now, input.thresholds.ae_idle_hours, input.kanban)) {
      rows.push(candidate({
        ruleCode: 'AE-IDLE',
        targetType: 'staff',
        targetId: String(member.staffId),
        level: 'yellow',
        ownerStaffId: member.staffId,
        period: input.periodKey,
        title: 'AE chưa gọi',
        body: `Không có cuộc gọi trong ${input.thresholds.ae_idle_hours} giờ làm`,
      }));
    }
    if (
      isAlertDrop(member.prevAnswerPct, member.answerPct, input.thresholds.ae_drop_percent)
      || isAlertDrop(member.prevWinPct, member.winPct, input.thresholds.ae_drop_percent)
    ) {
      rows.push(candidate({
        ruleCode: 'AE-DROP',
        targetType: 'staff',
        targetId: String(member.staffId),
        level: 'yellow',
        ownerStaffId: member.staffId,
        period: input.weekKey,
        title: 'Tỷ lệ AE giảm',
        body: 'Tỷ lệ nghe máy hoặc tỷ lệ chốt tuần này giảm so với tuần trước',
      }));
    }
  }
  for (const row of input.leads) {
    const kind = hotUncalledAlert(row.lead, input.kanban, input.thresholds, input.now);
    if (!kind) continue;
    rows.push(candidate({
      ruleCode: kind,
      targetType: 'lead',
      targetId: String(row.lead.id),
      level: kind === 'HOT-AE' ? 'info' : 'yellow',
      ownerStaffId: row.ownerId,
      period: input.periodKey,
      title: kind === 'HOT-AE' ? 'Lead nóng chưa gọi' : 'Lead nóng vẫn chưa gọi',
      body: `Lead #${row.lead.id}`,
    }));
  }
  return rows;
}

export function planAeTeamAlertTick(input: {
  inShift: boolean;
  now: Date;
  cooldownMinutes: number;
  escalateMinutes: number;
  periodKey: string;
  candidates: AeAlertCandidate[];
  existing: AeStoredAlert[];
}): AeAlertTickPlan {
  if (!input.inShift) return { insert: [], escalate: [], resolveIds: [] };
  const cooldownMs = input.cooldownMinutes * 60_000;
  const recentKeys = new Set(
    input.existing
      .filter((alert) => input.now.getTime() - new Date(alert.createdAt).getTime() < cooldownMs)
      .map((alert) => alert.dedupeKey),
  );
  const active = input.existing.filter((alert) => alert.status !== 'resolved');
  const activeKeys = new Set(active.map((alert) => alert.dedupeKey));
  const insert = input.candidates.filter((row) => !activeKeys.has(row.dedupeKey) && !recentKeys.has(row.dedupeKey));
  const escalate: Array<{ id: number; level: 'red' | 'esc' }> = [];
  const escAlerts: AeAlertCandidate[] = [];
  for (const alert of active) {
    if (alert.status !== 'open' || alert.level === 'info' || alert.level === 'esc' || alert.ruleCode === 'ESC') continue;
    const ageMinutes = (input.now.getTime() - new Date(alert.createdAt).getTime()) / 60_000;
    if (ageMinutes < input.escalateMinutes) continue;
    const level = alert.level === 'yellow' ? 'red' : 'esc';
    escalate.push({ id: alert.id, level });
    const dedupeKey = `ESC:alert:${alert.id}:${input.periodKey}`;
    if (activeKeys.has(dedupeKey) || recentKeys.has(dedupeKey)) continue;
    escAlerts.push({
      ruleCode: 'ESC',
      targetType: 'alert',
      targetId: String(alert.id),
      level: 'red',
      ownerStaffId: alert.ownerStaffId,
      dedupeKey,
      title: 'Cảnh báo leo thang',
      body: alert.ruleCode,
    });
  }
  const firing = new Set(input.candidates.map((row) => row.dedupeKey));
  const resolveIds = active.filter((alert) => {
    if (alert.ruleCode === 'ESC') {
      const source = active.find((item) => item.id === Number(alert.targetId));
      return !source || !firing.has(source.dedupeKey);
    }
    return !firing.has(alert.dedupeKey);
  }).map((alert) => alert.id);
  return { insert: [...insert, ...escAlerts], escalate, resolveIds };
}

function candidate(input: {
  ruleCode: string;
  targetType: AeAlertCandidate['targetType'];
  targetId: string;
  level: AeAlertLevel;
  ownerStaffId: number;
  period: string;
  title: string;
  body: string;
}): AeAlertCandidate {
  return {
    ruleCode: input.ruleCode,
    targetType: input.targetType,
    targetId: input.targetId,
    level: input.level,
    ownerStaffId: input.ownerStaffId,
    dedupeKey: `${input.ruleCode}:${input.targetType}:${input.targetId}:${input.period}`,
    title: input.title,
    body: input.body,
  };
}
