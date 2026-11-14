/** Min gap between phone call logs: case_1b.min_gap_working_hours (working hours). */

import { addBusinessHours } from '../leads-funnel/business-hours.util';

export type CallGapInput = {
  lastCallAt: Date | null;
  now: Date;
  minGapWorkingHours: number;
};

export type CallGapResult = {
  blocked: boolean;
  elapsedMinutes: number | null;
  nextAllowedAt: Date | null;
  minGapWorkingHours: number;
  message: string | null;
};

const ICT: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Saigon',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

function ictStamp(at: Date): { ymd: string; hm: string; dmy: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Saigon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  const hm = new Intl.DateTimeFormat('vi-VN', ICT).format(at);
  const dmy = `${parts.day}/${parts.month}`;
  return { ymd, hm, dmy };
}

export function formatCallGapRetryAt(nextAllowedAt: Date, now: Date): string {
  const next = ictStamp(nextAllowedAt);
  const today = ictStamp(now);
  return next.ymd === today.ymd ? next.hm : `${next.hm} ${next.dmy}`;
}

export function evaluateCallGap(input: CallGapInput): CallGapResult {
  const gapH = Number(input.minGapWorkingHours);
  const minGapWorkingHours = Number.isFinite(gapH) && gapH > 0 ? gapH : 0;
  if (!input.lastCallAt || minGapWorkingHours <= 0) {
    return {
      blocked: false,
      elapsedMinutes: null,
      nextAllowedAt: null,
      minGapWorkingHours,
      message: null,
    };
  }
  const last = input.lastCallAt;
  const nextAllowedAt = addBusinessHours(last, minGapWorkingHours);
  const elapsedMs = input.now.getTime() - last.getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  const blocked = input.now.getTime() < nextAllowedAt.getTime();
  if (!blocked) {
    return {
      blocked: false,
      elapsedMinutes,
      nextAllowedAt,
      minGapWorkingHours,
      message: null,
    };
  }
  const elapsedLabel = elapsedMinutes < 1 ? 'dưới 1 phút' : `${elapsedMinutes} phút`;
  const when = formatCallGapRetryAt(nextAllowedAt, input.now);
  return {
    blocked: true,
    elapsedMinutes,
    nextAllowedAt,
    minGapWorkingHours,
    message: `Cuộc gọi quá sát lần trước (cách ${elapsedLabel}) — chưa ghi. Gọi lại sau ${when}.`,
  };
}

/** Cooldown for identical activity / same-channel log spam (non-SLA-gap). */
export const ACTIVITY_DEDUPE_MINUTES = 3;

export type DuplicateLogInput = {
  previousAt: Date | null;
  now: Date;
  cooldownMinutes?: number;
};

export function evaluateDuplicateLog(input: DuplicateLogInput): CallGapResult {
  const minutes = Number(input.cooldownMinutes ?? ACTIVITY_DEDUPE_MINUTES);
  const cooldownMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : ACTIVITY_DEDUPE_MINUTES;
  if (!input.previousAt) {
    return {
      blocked: false,
      elapsedMinutes: null,
      nextAllowedAt: null,
      minGapWorkingHours: 0,
      message: null,
    };
  }
  const nextAllowedAt = new Date(input.previousAt.getTime() + cooldownMinutes * 60_000);
  const elapsedMs = input.now.getTime() - input.previousAt.getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));
  const blocked = input.now.getTime() < nextAllowedAt.getTime();
  if (!blocked) {
    return {
      blocked: false,
      elapsedMinutes,
      nextAllowedAt,
      minGapWorkingHours: 0,
      message: null,
    };
  }
  const elapsedLabel = elapsedMinutes < 1 ? 'dưới 1 phút' : `${elapsedMinutes} phút`;
  const when = formatCallGapRetryAt(nextAllowedAt, input.now);
  return {
    blocked: true,
    elapsedMinutes,
    nextAllowedAt,
    minGapWorkingHours: 0,
    message: `Bản ghi trùng (cùng kênh và kết quả, cách ${elapsedLabel}) — chưa ghi. Thử lại sau ${when}.`,
  };
}

export function evaluateDuplicateActivity(input: DuplicateLogInput): CallGapResult {
  const out = evaluateDuplicateLog(input);
  if (!out.blocked || !out.message) return out;
  const when = formatCallGapRetryAt(out.nextAllowedAt as Date, input.now);
  const elapsedLabel =
    out.elapsedMinutes == null || out.elapsedMinutes < 1 ? 'dưới 1 phút' : `${out.elapsedMinutes} phút`;
  return {
    ...out,
    message: `Nội dung trao đổi trùng với lần vừa ghi (cách ${elapsedLabel}) — chưa lưu. Thử lại sau ${when}.`,
  };
}
