import { HttpException, Inject, Injectable } from '@nestjs/common';
import { rightsStatus } from './cp-assets.service';
import { CP_TENANT_ID } from './cp-audit.repository';
import { assertNotQcBlocked } from './cp-qc.service';
import { cpScopeSql } from './cp-scope.util';
import { CP_VIDEOS_QUERY, CpVideosQueryPort, CpVideosService, CpVideoScope } from './cp-videos.service';

export const CP_DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
export const PUBLISH_STATUSES = [
  'draft',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'cancelled',
] as const;

export type CpPublishStatus = (typeof PUBLISH_STATUSES)[number];

export type CpPublishInput = {
  video_version_id?: string;
  channel?: string;
  scheduled_at?: string | null;
  tz?: string;
  copy?: string | null;
  hashtags?: string | null;
  thumbnail_asset_id?: string | null;
  cta?: string | null;
  utm_json?: unknown;
  audience?: string | null;
  compliance_label?: string | null;
};

export type CpPublishListQuery = CpVideoScope & {
  channel?: string;
  client?: string;
  project?: string;
  approval?: string;
  from?: string;
  to?: string;
};

export type SchedulableVersion = {
  approval_status?: unknown;
  qc_status?: unknown;
  snapshot_json?: unknown;
  qc_json?: unknown;
  brand_kit_version_id?: unknown;
};

export type SchedulableContext = {
  rightsStatuses?: Array<'ok' | 'warn' | 'block' | null>;
  kitRules?: Array<{ enforcement?: string; action_json?: unknown }>;
  disclaimerPresent?: boolean | null;
};

export type ChannelProfileRules = {
  ratio?: unknown;
  duration_sec?: unknown;
  caption_max?: unknown;
};

export type ChannelFacts = {
  ratio?: string | null;
  duration_sec?: number | null;
  caption?: string | null;
};

const DEFAULT_SCOPE: CpVideoScope = { scope: 'all', staffId: 0, teamIds: [] };

@Injectable()
export class CpPublishService {
  constructor(
    private readonly videos: CpVideosService,
    @Inject(CP_VIDEOS_QUERY) private readonly db: CpVideosQueryPort,
  ) {}

  async listProfiles() {
    const result = await this.db.query(
      `SELECT id, channel, rules_json FROM crm_cp_channel_profiles ORDER BY channel`,
    );
    return { items: result.rows.map(normalizeProfile) };
  }

  async list(query: CpPublishListQuery) {
    const allowed = projectScope(query, 2);
    const filters: string[] = [`p.tenant_id = $1`, allowed.sql];
    const params: unknown[] = [CP_TENANT_ID, ...allowed.params];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      filters.push(sql.replace('$?', `$${params.length}`));
    };
    if (query.channel) add('i.channel = $?', query.channel);
    if (query.client) add('p.agency_client_id = $?::uuid', query.client);
    if (query.project) add('p.id = $?::uuid', query.project);
    if (query.approval) add('v.approval_status = $?', query.approval);
    if (query.from) add('i.scheduled_at >= $?::timestamptz', query.from);
    if (query.to) add('i.scheduled_at <= $?::timestamptz', query.to);

    const result = await this.db.query(
      `SELECT i.*, v.approval_status, v.qc_status, d.name AS draft_name,
              p.id AS project_id, p.name AS project_name, p.agency_client_id
         FROM crm_cp_publish_items i
         JOIN crm_cp_video_versions v ON v.id = i.video_version_id
         JOIN crm_cp_video_drafts d ON d.id = v.draft_id
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE ${filters.join(' AND ')}
        ORDER BY i.scheduled_at NULLS LAST, i.id
        LIMIT 200`,
      params,
    );
    return { items: result.rows.map((row) => ({ ...row, kind: 'video' })) };
  }

  async listVersions(scope: CpVideoScope = DEFAULT_SCOPE) {
    const allowed = projectScope(scope, 2);
    const result = await this.db.query(
      `SELECT v.id, v.approval_status, v.qc_status, v.version_n, d.name AS draft_name,
              d.project_id, p.name AS project_name, p.agency_client_id
         FROM crm_cp_video_versions v
         JOIN crm_cp_video_drafts d ON d.id = v.draft_id
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE p.tenant_id = $1 AND ${allowed.sql}
        ORDER BY v.id DESC
        LIMIT 100`,
      [CP_TENANT_ID, ...allowed.params],
    );
    return {
      items: result.rows.map((row) => ({
        ...row,
        eligible: !isPublishLocked(row),
        lock_reason: lockReason(row),
      })),
    };
  }

  async getGate(versionId: string, scope: CpVideoScope = DEFAULT_SCOPE) {
    const version = await this.videos.getVersion(versionId, scope);
    const ctx = await this.schedulableContext(version);
    let lock: string | null = null;
    try {
      assertSchedulable(version, ctx);
    } catch (error) {
      lock = errorBody(error);
    }
    const approval = String(version.approval_status ?? '');
    return {
      version_id: version.id,
      schedulable: lock == null,
      lock_reason: lock,
      items: [
        gateRow('qc', 'QC', String(version.qc_status ?? ''), version.qc_status === 'blocked' ? 'qc_blocked' : null),
        gateRow('brand', 'Brand', approval.includes('brand') || approval === 'final_approved' ? approval : 'pending', null),
        gateRow('client', 'Client', approval === 'client_review' ? approval : approval === 'final_approved' ? 'final_approved' : 'pending',
          approval === 'client_review' ? 'not_final_approved' : null),
        gateRow('legal', 'Legal', approval.includes('legal') || approval === 'final_approved' ? approval : 'n/a', null),
        gateRow('scheduled', 'Scheduled', lock == null ? 'ready' : 'locked', lock),
        gateRow('lock_reason', 'Lock reason', lock, lock),
      ],
    };
  }

  async schedule(input: CpPublishInput, scope: CpVideoScope = DEFAULT_SCOPE) {
    const versionId = requiredUuid(input.video_version_id, 'video_version_id_required');
    const channel = requiredText(input.channel, 'channel_required');
    const version = await this.videos.getVersion(versionId, scope);
    const profile = await this.loadProfile(channel);
    const ctx = await this.schedulableContext(version);
    assertSchedulable(version, ctx);
    assertChannelProfile(profile.rules_json, {
      ...factsFromVersion(version),
      caption: [input.copy, input.hashtags].filter(Boolean).join(' '),
    });

    const scheduledAt = optionalTimestamp(input.scheduled_at);
    const status: CpPublishStatus = scheduledAt ? 'scheduled' : 'draft';
    const result = await this.db.query(
      `INSERT INTO crm_cp_publish_items (
         video_version_id, channel, profile_id, scheduled_at, tz, copy, hashtags,
         thumbnail_asset_id, cta, utm_json, audience, status, compliance_label
       ) VALUES (
         $1::uuid, $2, $3::uuid, $4::timestamptz, $5, $6, $7,
         $8::uuid, $9, $10::jsonb, $11, $12, $13
       )
       RETURNING *`,
      [
        version.id,
        channel,
        profile.id,
        scheduledAt,
        nullableText(input.tz) ?? CP_DEFAULT_TZ,
        nullableText(input.copy),
        nullableText(input.hashtags),
        optionalUuid(input.thumbnail_asset_id, 'invalid_thumbnail_asset_id'),
        nullableText(input.cta),
        JSON.stringify(input.utm_json ?? null),
        nullableText(input.audience),
        status,
        nullableText(input.compliance_label),
      ],
    );
    return { ...(result.rows[0] ?? cpThrow(500, { error: 'insert_failed' })), kind: 'video' };
  }

  private async loadProfile(channel: string) {
    const result = await this.db.query(
      `SELECT id, channel, rules_json FROM crm_cp_channel_profiles WHERE channel = $1 LIMIT 1`,
      [channel],
    );
    const row = result.rows[0] ?? cpThrow(400, { error: 'unknown_channel' });
    return normalizeProfile(row);
  }

  private async schedulableContext(version: Record<string, unknown>): Promise<SchedulableContext> {
    const assetIds = extractAssetIds(version);
    const rights = assetIds.length
      ? await this.db.query(
        `SELECT asset_id, expiry_on FROM crm_cp_asset_rights WHERE asset_id = ANY($1::uuid[])`,
        [assetIds],
      )
      : { rows: [] };
    const kitId = nullableText(version.brand_kit_version_id) ?? extractKitId(version);
    const rules = kitId
      ? await this.db.query(
        `SELECT enforcement, action_json FROM crm_cp_brand_rules WHERE kit_version_id = $1::uuid`,
        [kitId],
      )
      : { rows: [] };
    return {
      rightsStatuses: rights.rows.map((row) => rightsStatus(row.expiry_on as string | Date | null)),
      kitRules: rules.rows,
      disclaimerPresent: disclaimerPresent(version),
    };
  }
}

export function assertSchedulable(
  version: SchedulableVersion,
  ctx: SchedulableContext = {},
): void {
  if (String(version.approval_status ?? '') !== 'final_approved') {
    cpThrow(409, { error: 'not_final_approved' });
  }
  const qcStatus = version.qc_status == null ? null : String(version.qc_status);
  assertNotQcBlocked(qcStatus);
  if ((ctx.rightsStatuses ?? []).includes('block')) {
    cpThrow(409, { error: 'rights_blocked' });
  }
  const present = ctx.disclaimerPresent ?? disclaimerPresent(version);
  if (requiresDisclaimer(ctx.kitRules) && !present) {
    cpThrow(409, { error: 'disclaimer_required' });
  }
}

export function assertChannelProfile(rules: ChannelProfileRules, facts: ChannelFacts): void {
  const allowedRatios = textList(rules.ratio);
  const ratio = nullableText(facts.ratio);
  if (allowedRatios.length && (!ratio || !allowedRatios.includes(ratio))) {
    cpThrow(409, { error: 'channel_profile', reason: 'ratio' });
  }
  const durationRange = numberList(rules.duration_sec);
  const duration = facts.duration_sec == null ? null : Number(facts.duration_sec);
  if (durationRange.length >= 2) {
    const min = durationRange[0];
    const max = durationRange[1];
    if (duration == null || !Number.isFinite(duration) || duration < min || duration > max) {
      cpThrow(409, { error: 'channel_profile', reason: 'duration_sec' });
    }
  }
  const captionMax = Number(rules.caption_max);
  const caption = facts.caption ?? '';
  if (Number.isFinite(captionMax) && captionMax > 0 && caption.length > captionMax) {
    cpThrow(409, { error: 'channel_profile', reason: 'caption_max' });
  }
}

export function isPublishLocked(version: { approval_status?: unknown; qc_status?: unknown }): boolean {
  return String(version.approval_status ?? '') !== 'final_approved'
    || version.qc_status === 'blocked';
}

function lockReason(version: { approval_status?: unknown; qc_status?: unknown }): string | null {
  if (String(version.approval_status ?? '') !== 'final_approved') return 'not_final_approved';
  if (version.qc_status === 'blocked') return 'qc_blocked';
  return null;
}

function requiresDisclaimer(
  rules: Array<{ enforcement?: string; action_json?: unknown }> | undefined,
): boolean {
  return (rules ?? []).some((rule) => (
    rule.enforcement === 'block_publish' && actionRequiresDisclaimer(rule.action_json)
  ));
}

function actionRequiresDisclaimer(action: unknown): boolean {
  if (action == null) return false;
  if (typeof action === 'string') return action.toLowerCase().includes('disclaimer');
  if (Array.isArray(action)) {
    return action.some((item) => String(item).toLowerCase().includes('disclaimer'));
  }
  if (typeof action !== 'object') return false;
  const obj = action as Record<string, unknown>;
  if (obj.disclaimer === true || obj.require_disclaimer === true) return true;
  if (typeof obj.disclaimer === 'string' && obj.disclaimer.trim()) return true;
  if (Array.isArray(obj.actions) && actionRequiresDisclaimer(obj.actions)) return true;
  return Object.entries(obj).some(([key, value]) => (
    key.toLowerCase().includes('disclaimer') && Boolean(value)
  ));
}

function disclaimerPresent(version: SchedulableVersion): boolean {
  const snapshot = objectValue(version.snapshot_json);
  const qc = objectValue(version.qc_json);
  const checks = objectValue(qc.checks);
  const disclaimer = objectValue(checks.disclaimer);
  const facts = objectValue(qc.facts);
  if (snapshot.disclaimer_present === true || facts.disclaimer_present === true) return true;
  return disclaimer.result === 'passed';
}

function factsFromVersion(version: Record<string, unknown>): ChannelFacts {
  const snapshot = objectValue(version.snapshot_json);
  const draft = objectValue(snapshot.draft);
  const config = objectValue(draft.config_json ?? snapshot.config_json);
  const width = Number(snapshot.width ?? config.width);
  const height = Number(snapshot.height ?? config.height);
  return {
    ratio: nullableText(config.ratio) ?? ratioFromSize(width, height),
    duration_sec: numberOrNull(config.duration ?? snapshot.duration_sec ?? config.duration_sec),
  };
}

function extractAssetIds(version: Record<string, unknown>): string[] {
  const snapshot = objectValue(version.snapshot_json);
  const raw = Array.isArray(snapshot.asset_versions)
    ? snapshot.asset_versions
    : Array.isArray(snapshot.asset_ids)
      ? snapshot.asset_ids
      : [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'id' in item) {
        return String((item as { id: unknown }).id ?? '');
      }
      if (item && typeof item === 'object' && 'asset_id' in item) {
        return String((item as { asset_id: unknown }).asset_id ?? '');
      }
      return '';
    })
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
}

function extractKitId(version: Record<string, unknown>): string | null {
  const snapshot = objectValue(version.snapshot_json);
  const draft = objectValue(snapshot.draft);
  const kit = objectValue(snapshot.kit_version);
  return nullableText(
    version.brand_kit_version_id
    ?? draft.brand_kit_version_id
    ?? kit.id
    ?? snapshot.brand_kit_version_id,
  );
}

function normalizeProfile(row: Record<string, unknown>): {
  id: string;
  channel: string;
  rules_json: ChannelProfileRules;
} {
  return {
    id: String(row.id ?? ''),
    channel: String(row.channel ?? ''),
    rules_json: parseJson(row.rules_json),
  };
}

function parseJson(value: unknown): ChannelProfileRules {
  if (typeof value === 'string') {
    try {
      return objectValue(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return objectValue(value);
}

function ratioFromSize(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.round(width), Math.round(height));
  return `${Math.round(width) / divisor}:${Math.round(height) / divisor}`;
}

function projectScope(scope: CpVideoScope, startAt: number) {
  const raw = cpScopeSql({
    scope: scope.scope,
    staffId: scope.staffId,
    teamIds: scope.teamIds ?? [],
  });
  const token = raw.sql.includes('$teams') ? '$teams' : '$staff';
  return {
    sql: raw.sql.replaceAll(token, `$${startAt}`),
    params: raw.params,
  };
}

function gateRow(key: string, label: string, result: string | null, lock: string | null) {
  return { key, label, result: result || null, lock };
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function errorBody(error: unknown): string {
  if (error && typeof error === 'object' && 'error' in error) {
    return String((error as { error: unknown }).error);
  }
  return 'locked';
}

function optionalTimestamp(value: unknown): string | null {
  if (value == null || value === '') return null;
  const text = String(value);
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) cpThrow(400, { error: 'invalid_scheduled_at' });
  return new Date(timestamp).toISOString();
}

function requiredText(value: unknown, error: string): string {
  const text = String(value ?? '').trim();
  if (!text) cpThrow(400, { error });
  return text;
}

function nullableText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function requiredUuid(value: unknown, error: string): string {
  const id = String(value ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    cpThrow(400, { error });
  }
  return id;
}

function optionalUuid(value: unknown, error: string): string | null {
  if (value == null || value === '') return null;
  return requiredUuid(value, error);
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
