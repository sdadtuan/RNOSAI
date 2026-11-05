import { BadRequestException } from '@nestjs/common';
import type { LeadSlaSettingsPayload } from './lead-sla-settings.defaults';
import { LEAD_SLA_SETTINGS_SCHEMA_VERSION } from './lead-sla-settings.defaults';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type LeadSlaValidationError = {
  code: string;
  message: string;
  field?: string;
};

export function validateLeadSlaSettingsPayload(
  payload: LeadSlaSettingsPayload,
): LeadSlaValidationError[] {
  const errors: LeadSlaValidationError[] = [];

  if (payload.schema_version !== LEAD_SLA_SETTINGS_SCHEMA_VERSION) {
    errors.push({
      code: 'schema_version_mismatch',
      message: `schema_version must be ${LEAD_SLA_SETTINGS_SCHEMA_VERSION}`,
      field: 'schema_version',
    });
  }

  if (!(payload.fr1_hours >= 0.5 && payload.fr1_hours <= 8)) {
    errors.push({
      code: 'fr1_out_of_range',
      message: 'fr1_hours must be between 0.5 and 8',
      field: 'fr1_hours',
    });
  }

  if (!payload.fr1_channels?.length) {
    errors.push({
      code: 'fr1_channels_required',
      message: 'fr1_channels must not be empty',
      field: 'fr1_channels',
    });
  }

  if (!payload.eligible_pipeline_stages?.length) {
    errors.push({
      code: 'eligible_stages_required',
      message: 'eligible_pipeline_stages must not be empty',
      field: 'eligible_pipeline_stages',
    });
  }

  if (payload.case_1b.min_attempts < 1) {
    errors.push({
      code: 'invalid_min_attempts',
      message: 'case_1b.min_attempts must be ≥ 1',
      field: 'case_1b.min_attempts',
    });
  }
  if (payload.case_1b.max_working_days < 1) {
    errors.push({
      code: 'invalid_max_working_days',
      message: 'case_1b.max_working_days must be ≥ 1',
      field: 'case_1b.max_working_days',
    });
  }
  if (payload.case_1b.hot_max_working_days > payload.case_1b.max_working_days) {
    errors.push({
      code: 'hot_stricter_required',
      message: 'hot_max_working_days must be ≤ case_1b.max_working_days',
      field: 'case_1b.hot_max_working_days',
    });
  }
  if (payload.case_1b.hot_min_attempts > payload.case_1b.min_attempts) {
    // hot should be stricter = fewer days OR fewer attempts allowed before reassign — hot_min_attempts typically ≤ normal
    // Spec: hot days ≤ normal; hot_min_attempts is usually lower. If hot needs MORE attempts that's ok; only days must be stricter.
  }

  if (!TIME_RE.test(payload.working_hours.start) || !TIME_RE.test(payload.working_hours.end)) {
    errors.push({
      code: 'invalid_working_hours',
      message: 'working_hours start/end must be HH:MM',
      field: 'working_hours',
    });
  }
  if (!payload.working_hours.days?.length) {
    errors.push({
      code: 'working_days_required',
      message: 'working_hours.days must not be empty',
      field: 'working_hours.days',
    });
  }

  return errors;
}

export function assertValidLeadSlaSettings(payload: LeadSlaSettingsPayload): void {
  const errors = validateLeadSlaSettingsPayload(payload);
  if (errors.length) {
    throw new BadRequestException({
      error: errors[0].code,
      message: errors[0].message,
      errors,
    });
  }
}

export function assertPublishNote(note: string): void {
  const n = String(note ?? '').trim();
  if (n.length < 10) {
    throw new BadRequestException({
      error: 'publish_note_required',
      message: 'Publish note must be at least 10 characters',
    });
  }
}

/** §16.6 — enable reassign only after dry_run ran ≥ min days, unless SUPER-ADMIN override. */
export function assertCanEnableReassign(
  previous: LeadSlaSettingsPayload,
  next: LeadSlaSettingsPayload,
  opts: { overrideDryRun: boolean; isSuperAdmin: boolean; now?: Date },
): void {
  const enabling =
    !previous.feature_flags.lead_sla_reassign_enabled &&
    next.feature_flags.lead_sla_reassign_enabled;
  if (!enabling) return;
  if (opts.overrideDryRun && opts.isSuperAdmin) return;

  const started = previous.feature_flags.dry_run_started_at;
  const minDays = Number(next.feature_flags.min_dry_run_days ?? 3);
  if (!started) {
    throw new BadRequestException({
      error: 'dry_run_incomplete',
      message: `Enable reassign requires dry_run for ≥ ${minDays} days (or SUPER-ADMIN override)`,
    });
  }
  const startedAt = new Date(started);
  const now = opts.now ?? new Date();
  const elapsedDays = (now.getTime() - startedAt.getTime()) / (24 * 3600 * 1000);
  if (elapsedDays < minDays) {
    throw new BadRequestException({
      error: 'dry_run_incomplete',
      message: `Dry-run only ${elapsedDays.toFixed(1)} days; need ≥ ${minDays} (or SUPER-ADMIN override)`,
    });
  }
}

export function previewImpactCopy(
  previous: LeadSlaSettingsPayload,
  next: LeadSlaSettingsPayload,
): string[] {
  const lines: string[] = [];
  if (previous.fr1_hours !== next.fr1_hours) {
    lines.push(
      `FR1 đổi ${previous.fr1_hours}h→${next.fr1_hours}h: áp dụng lead gán MỚI sau publish. Lead đang mở: không tự sửa fr1_due_at trừ Recalc.`,
    );
  }
  if (JSON.stringify(previous.case_1b) !== JSON.stringify(next.case_1b)) {
    lines.push(
      'Số liệu case 1b: áp dụng lần recompute_hold_until tiếp theo (sau call log) hoặc Recalc. Job đọc config lúc chạy.',
    );
  }
  if (JSON.stringify(previous.case_1c) !== JSON.stringify(next.case_1c)) {
    lines.push('Số liệu case 1c: áp dụng lần recompute / job tiếp theo.');
  }
  if (JSON.stringify(previous.case_1a) !== JSON.stringify(next.case_1a)) {
    lines.push('Số liệu case 1a: áp dụng lần recompute tiếp theo.');
  }
  if (
    JSON.stringify(previous.working_hours) !== JSON.stringify(next.working_hours) ||
    JSON.stringify(previous.holidays) !== JSON.stringify(next.holidays)
  ) {
    lines.push('Giờ làm việc / holidays: chỉ lead assign mới sau publish.');
  }
  if (
    previous.feature_flags.lead_sla_reassign_enabled !==
    next.feature_flags.lead_sla_reassign_enabled
  ) {
    lines.push(
      next.feature_flags.lead_sla_reassign_enabled
        ? 'Bật auto-reassign: job áp dụng ngay theo config hiện tại (sau khi qua dry-run gate).'
        : 'Tắt auto-reassign: job dừng ngay.',
    );
  }
  if (
    previous.feature_flags.lead_sla_reassign_dry_run !==
    next.feature_flags.lead_sla_reassign_dry_run
  ) {
    lines.push('Flag dry_run: áp dụng ngay cho job.');
  }
  lines.push('Pool / accepts_leads / redistribute: job & assign đọc ngay theo config hiện tại.');
  if (!lines.length) {
    lines.push('Không có thay đổi field quan trọng — vẫn tạo revision khi publish.');
  }
  return lines;
}
