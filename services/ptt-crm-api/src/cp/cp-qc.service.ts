import { HttpException, Inject, Injectable } from '@nestjs/common';
import { CP_VIDEOS_QUERY, CpVideosQueryPort, CpVideosService, CpVideoScope } from './cp-videos.service';

export const QC_CHECK_KEYS = [
  'technical',
  'safe_area',
  'caption_overflow',
  'logo',
  'cta',
  'disclaimer',
  'missing_audio',
  'loudness',
  'black_frozen',
  'moderation',
] as const;

export type QcCheckKey = (typeof QC_CHECK_KEYS)[number];
export type QcResult = 'passed' | 'warning' | 'blocked';

export type QcCheckReport = {
  result: QcResult;
  reason: string | null;
};

export type QcReport = {
  overall: QcResult;
  checks: Record<QcCheckKey, QcCheckReport>;
};

export type QcFacts = {
  width?: number | null;
  height?: number | null;
  duration_sec?: number | null;
  has_audio?: boolean | null;
  safe_area_ok?: boolean | null;
  caption_overflow?: boolean | null;
  logo_present?: boolean | null;
  cta_present?: boolean | null;
  disclaimer_present?: boolean | null;
  loudness_lufs?: number | null;
  black_frozen?: boolean | null;
  moderation?: string | boolean | null;
};

const DEFAULT_SCOPE: CpVideoScope = { scope: 'all', staffId: 0, teamIds: [] };

@Injectable()
export class CpQcService {
  constructor(
    private readonly videos: CpVideosService,
    @Inject(CP_VIDEOS_QUERY) private readonly db: CpVideosQueryPort,
  ) {}

  async run(
    id: string,
    facts: QcFacts = {},
    scope: CpVideoScope = DEFAULT_SCOPE,
  ) {
    const version = await this.videos.getVersion(id, scope);
    const report = evaluateQcChecks({
      ...factsFromVersion(version),
      ...compactFacts(facts),
    });
    const updated = await this.db.query(
      `UPDATE crm_cp_video_versions
          SET qc_status = $2, qc_json = $3::jsonb
        WHERE id = $1::uuid
        RETURNING *`,
      [version.id, report.overall, JSON.stringify(report)],
    );
    const row = updated.rows[0] ?? cpThrow(404, { error: 'not_found' });
    return {
      ...row,
      qc_status: report.overall,
      qc_json: typeof row.qc_json === 'string' ? JSON.parse(row.qc_json) as QcReport : report,
    };
  }

  async exportFinal(id: string, scope: CpVideoScope = DEFAULT_SCOPE) {
    const version = await this.videos.getVersion(id, scope);
    assertExportable(version);
    return {
      id: version.id,
      output_uri: version.output_uri ?? null,
      qc_status: version.qc_status ?? null,
    };
  }
}

export function evaluateQcChecks(facts: QcFacts = {}): QcReport {
  const checks: Record<QcCheckKey, QcCheckReport> = {
    technical: technicalCheck(facts),
    safe_area: presenceCheck(facts.safe_area_ok, 'safe_area_missing', 'safe_area_violated'),
    caption_overflow: facts.caption_overflow === true
      ? report('blocked', 'caption_overflow')
      : facts.caption_overflow === false
        ? report('passed')
        : report('warning', 'caption_overflow_unknown'),
    logo: presenceCheck(facts.logo_present, 'logo_missing', 'logo_absent'),
    cta: presenceCheck(facts.cta_present, 'cta_missing', 'cta_absent'),
    disclaimer: presenceCheck(facts.disclaimer_present, 'disclaimer_missing', 'disclaimer_absent'),
    missing_audio: facts.has_audio === false
      ? report('blocked', 'missing_audio')
      : facts.has_audio === true
        ? report('passed')
        : report('warning', 'audio_unknown'),
    loudness: loudnessCheck(facts.loudness_lufs),
    black_frozen: facts.black_frozen === true
      ? report('blocked', 'black_frozen')
      : facts.black_frozen === false
        ? report('passed')
        : report('warning', 'black_frozen_unknown'),
    moderation: moderationCheck(facts.moderation),
  };
  return {
    overall: rollupQc(Object.values(checks).map((item) => item.result)),
    checks,
  };
}

export function assertNotQcBlocked(qcStatus: string | null | undefined): void {
  if (qcStatus === 'blocked') cpThrow(409, { error: 'qc_blocked' });
}

export function assertExportable(version: { qc_status?: unknown }): void {
  const status = version.qc_status == null ? null : String(version.qc_status);
  assertNotQcBlocked(status);
}

function technicalCheck(facts: QcFacts): QcCheckReport {
  const hasWidth = facts.width != null;
  const hasHeight = facts.height != null;
  const hasDuration = facts.duration_sec != null;
  if (!hasWidth && !hasHeight && !hasDuration) {
    return report('warning', 'technical_unknown');
  }
  const width = Number(facts.width);
  const height = Number(facts.height);
  const duration = Number(facts.duration_sec);
  if (
    (hasWidth && (!Number.isFinite(width) || width <= 0))
    || (hasHeight && (!Number.isFinite(height) || height <= 0))
    || (hasDuration && (!Number.isFinite(duration) || duration <= 0))
  ) {
    return report('blocked', 'technical_invalid');
  }
  if (!hasWidth || !hasHeight || !hasDuration) {
    return report('warning', 'technical_incomplete');
  }
  return report('passed');
}

function presenceCheck(
  value: boolean | null | undefined,
  missing: string,
  absent: string,
): QcCheckReport {
  if (value === true) return report('passed');
  if (value === false) return report('blocked', absent);
  return report('warning', missing);
}

function loudnessCheck(lufs: number | null | undefined): QcCheckReport {
  if (lufs == null || !Number.isFinite(Number(lufs))) {
    return report('warning', 'loudness_unknown');
  }
  const value = Number(lufs);
  if (value < -24 || value > -8) return report('blocked', 'loudness_out_of_range');
  if (value < -16 || value > -12) return report('warning', 'loudness_off_target');
  return report('passed');
}

function moderationCheck(value: string | boolean | null | undefined): QcCheckReport {
  if (value === true || value === 'blocked') return report('blocked', 'moderation_blocked');
  if (value === 'flagged' || value === 'warning') return report('warning', 'moderation_flagged');
  if (value === false || value === 'ok' || value === 'passed') return report('passed');
  return report('warning', 'moderation_unknown');
}

function rollupQc(results: QcResult[]): QcResult {
  if (results.includes('blocked')) return 'blocked';
  if (results.includes('warning')) return 'warning';
  return 'passed';
}

function report(result: QcResult, reason: string | null = null): QcCheckReport {
  return { result, reason };
}

function factsFromVersion(version: Record<string, unknown>): QcFacts {
  const snapshot = objectValue(version.snapshot_json);
  const draft = objectValue(snapshot.draft);
  const config = objectValue(draft.config_json ?? snapshot.config_json);
  const stored = objectValue(objectValue(version.qc_json).facts ?? snapshot.qc_facts ?? snapshot.facts);
  return compactFacts({
    width: numberOrNull(stored.width ?? snapshot.width ?? config.width),
    height: numberOrNull(stored.height ?? snapshot.height ?? config.height),
    duration_sec: numberOrNull(stored.duration_sec ?? snapshot.duration_sec ?? config.duration),
    has_audio: boolOrNull(stored.has_audio ?? snapshot.has_audio),
    safe_area_ok: boolOrNull(stored.safe_area_ok ?? snapshot.safe_area_ok),
    caption_overflow: boolOrNull(stored.caption_overflow ?? snapshot.caption_overflow),
    logo_present: boolOrNull(stored.logo_present ?? snapshot.logo_present),
    cta_present: boolOrNull(stored.cta_present ?? snapshot.cta_present),
    disclaimer_present: boolOrNull(stored.disclaimer_present ?? snapshot.disclaimer_present),
    loudness_lufs: numberOrNull(stored.loudness_lufs ?? snapshot.loudness_lufs),
    black_frozen: boolOrNull(stored.black_frozen ?? snapshot.black_frozen),
    moderation: (stored.moderation ?? snapshot.moderation ?? snapshot.moderation_blocked) as QcFacts['moderation'],
  });
}

function compactFacts(facts: QcFacts): QcFacts {
  return Object.fromEntries(
    Object.entries(facts).filter(([, value]) => value !== undefined),
  ) as QcFacts;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function boolOrNull(value: unknown): boolean | null {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return null;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
