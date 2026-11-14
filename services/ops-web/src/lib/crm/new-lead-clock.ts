import {
  defaultTeamSlaDocument,
  teamSlaProfile,
  type SaleTeamClocks,
  type TeamSlaCalendar,
  type TeamSlaDocument,
} from './team-sla-profiles';

const SAIGON_OFFSET_MS = 7 * 60 * 60 * 1000;

import { addBusinessHours, addBusinessMinutes } from '@/lib/crm/business-hours';

export type NewLeadClockPhase = 'claim' | 'update' | 'done' | 'unset';

export type NewLeadClock = {
  phase: NewLeadClockPhase;
  label: string;
  dueAt: string | null;
  remainingMs: number | null;
  overdue: boolean;
  detail: string;
};

type Parts = { y: number; mo: number; day: number; h: number; mi: number; jsDay: number };

function saigonParts(d: Date): Parts {
  const local = new Date(d.getTime() + SAIGON_OFFSET_MS);
  return {
    y: local.getUTCFullYear(),
    mo: local.getUTCMonth(),
    day: local.getUTCDate(),
    h: local.getUTCHours(),
    mi: local.getUTCMinutes(),
    jsDay: local.getUTCDay(),
  };
}

function fromSaigon(y: number, mo: number, day: number, h: number, mi: number): Date {
  return new Date(Date.UTC(y, mo, day, h, mi, 0, 0) - SAIGON_OFFSET_MS);
}

function parseHm(hm: string): { h: number; m: number } | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hm)) return null;
  const [h, m] = hm.split(':').map(Number);
  return { h, m };
}

function specDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

function isWorkingDay(at: Date, days: number[]): boolean {
  return days.includes(specDay(saigonParts(at).jsDay));
}

function atTime(at: Date, h: number, m: number): Date {
  const p = saigonParts(at);
  return fromSaigon(p.y, p.mo, p.day, h, m);
}

function addDays(at: Date, days: number): Date {
  const p = saigonParts(at);
  return fromSaigon(p.y, p.mo, p.day + days, 12, 0);
}

function sameSaigonDay(a: Date, b: Date): boolean {
  const pa = saigonParts(a);
  const pb = saigonParts(b);
  return pa.y === pb.y && pa.mo === pb.mo && pa.day === pb.day;
}

export function isInsideSaleShift(at: Date, calendar: TeamSlaCalendar): boolean {
  const start = parseHm(calendar.start);
  const end = parseHm(calendar.end);
  if (!start || !end || !calendar.days.length) return false;
  if (!isWorkingDay(at, calendar.days)) return false;
  const p = saigonParts(at);
  const mins = p.h * 60 + p.mi;
  return mins >= start.h * 60 + start.m && mins < end.h * 60 + end.m;
}

function nextCutoff(from: Date, calendar: TeamSlaCalendar, time: string): Date | null {
  const hm = parseHm(time);
  if (!hm || !calendar.days.length) return null;
  for (let i = 0; i < 14; i += 1) {
    const day = addDays(from, i);
    if (!isWorkingDay(day, calendar.days)) continue;
    const cutoff = atTime(day, hm.h, hm.m);
    if (cutoff.getTime() > from.getTime()) return cutoff;
  }
  return null;
}

export function saleClaimDueAt(
  assignedAt: Date,
  calendar: TeamSlaCalendar,
  sale: SaleTeamClocks,
): Date | null {
  const minutes = sale.claim_in_hours_minutes;
  if (isInsideSaleShift(assignedAt, calendar) && minutes != null && minutes > 0) {
    const due = new Date(assignedAt.getTime() + minutes * 60_000);
    const end = parseHm(calendar.end);
    if (end && sameSaigonDay(assignedAt, due)) {
      const endAt = atTime(assignedAt, end.h, end.m);
      if (due.getTime() <= endAt.getTime()) return due;
    }
  }
  return nextCutoff(assignedAt, calendar, sale.claim_after_hours_time);
}

export function formatNewLeadDueLabel(at: Date): string {
  const p = saigonParts(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(p.h)}:${pad(p.mi)} ${pad(p.day)}/${pad(p.mo + 1)}`;
}

export function formatNewLeadOverdueLabel(overdueMs: number): string {
  const totalMin = Math.max(1, Math.floor(Math.max(0, overdueMs) / 60_000));
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days >= 1) {
    return hours > 0 ? `Trễ ${days} ngày ${hours} giờ` : `Trễ ${days} ngày`;
  }
  if (hours >= 1) {
    return mins > 0 ? `Trễ ${hours} giờ ${mins} phút` : `Trễ ${hours} giờ`;
  }
  return `Trễ ${totalMin} phút`;
}

function clockOf(input: {
  phase: NewLeadClockPhase;
  label: string;
  due: Date | null;
  now: Date;
  detail: string;
}): NewLeadClock {
  if (!input.due) {
    return {
      phase: input.phase,
      label: input.label,
      dueAt: null,
      remainingMs: null,
      overdue: false,
      detail: input.detail,
    };
  }
  const remainingMs = input.due.getTime() - input.now.getTime();
  return {
    phase: input.phase,
    label: input.label,
    dueAt: input.due.toISOString(),
    remainingMs,
    overdue: remainingMs <= 0,
    detail: input.detail,
  };
}

export function resolveNewLeadClock(input: {
  document?: TeamSlaDocument | null;
  assignedAt?: string | null;
  claimedAt?: string | null;
  firstCallAt?: string | null;
  /** B2 / first-contact already finished, or lead has moved past Tư vấn. */
  completed?: boolean;
  now?: Date;
}): NewLeadClock {
  const now = input.now ?? new Date();
  const profile = teamSlaProfile(input.document ?? defaultTeamSlaDocument(), 'sale_service');
  const assigned = input.assignedAt ? new Date(input.assignedAt) : null;
  if (!assigned || Number.isNaN(assigned.getTime())) {
    return {
      phase: 'unset',
      label: 'Chưa có giờ gán',
      dueAt: null,
      remainingMs: null,
      overdue: false,
      detail: 'Lead chưa có mốc được gán nên chưa mở đồng hồ nhận.',
    };
  }

  // Stop both the 15-minute claim clock and the post-claim update clock once
  // the first call is logged, B2 is done, or the lead has left first-contact.
  if (input.firstCallAt || input.completed) {
    return {
      phase: 'done',
      label: input.firstCallAt ? 'Đã cập nhật cuộc gọi' : 'Đã hoàn thành liên hệ đầu',
      dueAt: null,
      remainingMs: null,
      overdue: false,
      detail: 'Hạn nhận 15 phút và hạn cập nhật sau khi nhận đã đóng.',
    };
  }

  const claimMinutes = profile.sale.claim_in_hours_minutes ?? 15;
  const updateHours = profile.sale.update_after_claim_hours ?? 1;
  const reassignHours = profile.sale.reassign_after_claim_hours ?? 2;
  const claimed = input.claimedAt ? new Date(input.claimedAt) : null;

  if (!claimed || Number.isNaN(claimed.getTime())) {
    const due = saleClaimDueAt(assigned, profile.calendar, profile.sale);
    const outside = !isInsideSaleShift(assigned, profile.calendar);
    const dueText = due ? formatNewLeadDueLabel(due) : '—';
    const hoursHint = `${profile.calendar.start || '08:30'}–${profile.calendar.end || '18:30'}`;
    return clockOf({
      phase: 'claim',
      label: `Chưa nhận · nhận trước ${dueText}`,
      due,
      now,
      detail: outside
        ? `Ngoài ca ${hoursHint}. Hạn nhận ${profile.sale.claim_after_hours_time || '08:30'} ngày làm việc kế.`
        : `Trong ca (${hoursHint} T2–T6). Nhận trong ${claimMinutes} phút kể từ lúc gán.`,
    });
  }

  const updateDue =
    updateHours > 0 ? addBusinessHours(claimed, updateHours) : null;
  const reassignDue =
    reassignHours > 0 ? addBusinessHours(claimed, reassignHours) : null;
  const dueText = updateDue ? formatNewLeadDueLabel(updateDue) : '—';
  const hoursHint = `${profile.calendar.start || '08:30'}–${profile.calendar.end || '18:30'} T2–T6`;
  const reassignText = reassignDue ? formatNewLeadDueLabel(reassignDue) : '';
  return clockOf({
    phase: 'update',
    label: `Đã nhận · cập nhật trước ${dueText}`,
    due: updateDue,
    now,
    detail: reassignDue
      ? `Hoàn tất thông tin trong ${updateHours} giờ làm việc (${hoursHint}). Chưa cập nhật sau ${reassignHours} giờ thì tới hạn chuyển Sales khác (${reassignText}).`
      : `Hoàn tất thông tin trong ${updateHours} giờ làm việc (${hoursHint}).`,
  });
}
