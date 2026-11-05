import { HttpException, Inject, Injectable, Optional } from '@nestjs/common';
import { rightsStatus } from './cp-assets.service';
import { CpAuditRepository, CP_TENANT_ID } from './cp-audit.repository';
import { assertNotQcBlocked } from './cp-qc.service';
import { cpScopeSql } from './cp-scope.util';
import { CpSettingsService } from './cp-settings.service';
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

export type CpBulkWindow = {
  start?: string;
  end?: string;
};

export type CpBulkRule = {
  n_per_day?: number;
  windows?: CpBulkWindow[];
  weekdays?: number[];
};

export type CpBulkInput = {
  video_version_ids?: string[];
  batch_item_ids?: string[];
  channel?: string;
  tz?: string;
  copy?: string | null;
  hashtags?: string | null;
  thumbnail_asset_id?: string | null;
  cta?: string | null;
  utm_json?: unknown;
  audience?: string | null;
  compliance_label?: string | null;
  rule?: CpBulkRule;
  from?: string;
};

export type CpBulkSkipped = {
  video_version_id: string;
  reason: string;
};

const DEFAULT_SCOPE: CpVideoScope = { scope: 'all', staffId: 0, teamIds: [] };

export function nativePublishEnabled(
  settingsNative?: boolean | null,
  env = process.env.CP_PUBLISH_NATIVE,
): boolean {
  if (settingsNative === true) return true;
  const flag = String(env ?? '').trim().toLowerCase();
  return flag === '1' || flag === 'true';
}

export function fileExportPostRef(itemId: string): string {
  return `export:${itemId}`;
}

export function resolvePublishPostRef(
  itemId: string,
  channel: string,
  nativeEnabled: boolean,
): string {
  if (nativeEnabled) return `native:${channel}:${itemId}`;
  return fileExportPostRef(itemId);
}

export function looksNativeSocialRef(postRef: string | null | undefined): boolean {
  return /tiktok|instagram|reels|facebook\.com\/reel/i.test(String(postRef ?? ''));
}

export function spreadBulkSlots(
  count: number,
  rule: CpBulkRule = {},
  tz = CP_DEFAULT_TZ,
  from: Date = new Date(),
): string[] {
  const nPerDay = Math.max(1, Number(rule.n_per_day) || 1);
  const weekdays = (rule.weekdays?.length ? rule.weekdays : [1, 2, 3, 4, 5])
    .map((day) => Number(day))
    .filter((day) => day >= 1 && day <= 7);
  const windows = (rule.windows?.length ? rule.windows : [{ start: '09:00', end: '10:00' }])
    .map((window) => ({
      start: String(window.start ?? '09:00'),
      end: String(window.end ?? '10:00'),
    }));
  const slots: string[] = [];
  let ymd = ymdInTz(from, tz);
  let guard = 0;
  while (slots.length < count && guard++ < 400) {
    if (weekdays.includes(isoWeekdayFromYmd(ymd))) {
      for (const stamp of slotsOnDay(ymd, nPerDay, windows, tz)) {
        if (slots.length >= count) break;
        if (new Date(stamp).getTime() <= from.getTime()) continue;
        slots.push(stamp);
      }
    }
    ymd = addYmd(ymd, 1);
  }
  return slots;
}

@Injectable()
export class CpPublishService {
  constructor(
    private readonly videos: CpVideosService,
    @Inject(CP_VIDEOS_QUERY) private readonly db: CpVideosQueryPort,
    @Optional() private readonly audit?: CpAuditRepository,
    @Optional() private readonly settings?: CpSettingsService,
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
      `SELECT v.id, v.approval_status, v.qc_status, v.version_n, v.snapshot_json, v.qc_json,
              d.name AS draft_name, d.project_id, d.brand_kit_version_id,
              p.name AS project_name, p.agency_client_id
         FROM crm_cp_video_versions v
         JOIN crm_cp_video_drafts d ON d.id = v.draft_id
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE p.tenant_id = $1 AND ${allowed.sql}
        ORDER BY v.id DESC
        LIMIT 100`,
      [CP_TENANT_ID, ...allowed.params],
    );
    const items = [];
    for (const row of result.rows) {
      const ctx = await this.schedulableContext(row);
      let lock: string | null = null;
      try {
        assertSchedulable(row, ctx);
      } catch (error) {
        lock = errorBody(error);
      }
      items.push({
        id: row.id,
        approval_status: row.approval_status,
        qc_status: row.qc_status,
        version_n: row.version_n,
        draft_name: row.draft_name,
        project_id: row.project_id,
        project_name: row.project_name,
        agency_client_id: row.agency_client_id,
        eligible: lock == null,
        schedulable: lock == null,
        lock_reason: lock,
      });
    }
    return { items };
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

    const scheduledAt = optionalTimestamp(input.scheduled_at, nullableText(input.tz) ?? CP_DEFAULT_TZ);
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

  async deliver(id: string, scope: CpVideoScope = DEFAULT_SCOPE): Promise<Record<string, unknown> & { kind: 'video' }> {
    const item = await this.loadItem(id, scope);
    const outcome = await this.fileExportHandoff(item, scope);
    const row = await this.persistOutcome(item, outcome);
    if (this.audit) {
      await this.audit.insert({
        actor_id: scope.staffId > 0 ? scope.staffId : null,
        action: 'publish.deliver',
        resource_type: 'publish_item',
        resource_id: String(item.id),
        payload_json: {
          status: outcome.status,
          post_ref: outcome.post_ref,
          last_error: outcome.last_error,
        },
      });
    }
    return row;
  }

  async retry(id: string, scope: CpVideoScope = DEFAULT_SCOPE): Promise<Record<string, unknown> & { kind: 'video' }> {
    const item = await this.loadItem(id, scope);
    if (this.audit) {
      await this.audit.insert({
        actor_id: scope.staffId > 0 ? scope.staffId : null,
        action: 'publish.retry',
        resource_type: 'publish_item',
        resource_id: String(item.id),
        payload_json: { previous_status: item.status, last_error: item.last_error ?? null },
      });
    }
    const outcome = await this.fileExportHandoff(item, scope);
    return this.persistOutcome(item, outcome);
  }

  async listHistory(id: string, scope: CpVideoScope = DEFAULT_SCOPE) {
    await this.loadItem(id, scope);
    const result = await this.db.query(
      `SELECT id, actor_id, action, resource_type, resource_id, payload_json, created_at
         FROM crm_cp_activity
        WHERE tenant_id = $1 AND resource_type = 'publish_item' AND resource_id = $2
        ORDER BY created_at DESC
        LIMIT 50`,
      [CP_TENANT_ID, id],
    );
    return { items: result.rows };
  }

  async bulkSchedule(input: CpBulkInput, scope: CpVideoScope = DEFAULT_SCOPE) {
    const channel = requiredText(input.channel, 'channel_required');
    const tz = nullableText(input.tz) ?? CP_DEFAULT_TZ;
    const versionIds = await this.resolveBulkVersionIds(input, scope);
    const profile = await this.loadProfile(channel);
    const accepted: Array<{ version: Record<string, unknown> }> = [];
    const skipped: CpBulkSkipped[] = [];

    for (const versionId of versionIds) {
      try {
        const version = await this.videos.getVersion(versionId, scope);
        const ctx = await this.schedulableContext(version);
        assertSchedulable(version, ctx);
        assertChannelProfile(profile.rules_json, {
          ...factsFromVersion(version),
          caption: [input.copy, input.hashtags].filter(Boolean).join(' '),
        });
        accepted.push({ version });
      } catch (error) {
        skipped.push({ video_version_id: versionId, reason: handoffError(error) });
      }
    }

    const from = input.from ? new Date(input.from) : new Date();
    const slots = spreadBulkSlots(accepted.length, input.rule ?? {}, tz, from);
    const items: Record<string, unknown>[] = [];

    for (const [index, row] of accepted.entries()) {
      const created = await this.insertPublishItem({
        versionId: String(row.version.id),
        channel,
        profileId: profile.id,
        scheduledAt: slots[index] ?? null,
        tz,
        copy: nullableText(input.copy),
        hashtags: nullableText(input.hashtags),
        thumbnailAssetId: optionalUuid(input.thumbnail_asset_id, 'invalid_thumbnail_asset_id'),
        cta: nullableText(input.cta),
        utmJson: input.utm_json ?? null,
        audience: nullableText(input.audience),
        compliance: nullableText(input.compliance_label),
        status: slots[index] ? 'scheduled' : 'draft',
      });
      items.push(created);
      if (this.audit) {
        await this.audit.insert({
          actor_id: scope.staffId > 0 ? scope.staffId : null,
          action: 'publish.schedule',
          resource_type: 'publish_item',
          resource_id: String(created.id),
          payload_json: {
            video_version_id: String(row.version.id),
            channel,
            scheduled_at: created.scheduled_at ?? null,
          },
        });
      }
    }

    return { items, skipped, kind: 'video' };
  }

  private async loadItem(id: string, scope: CpVideoScope) {
    const itemId = requiredUuid(id, 'invalid_publish_item_id');
    const allowed = projectScope(scope, 3);
    const result = await this.db.query(
      `SELECT i.*, v.approval_status, v.qc_status, d.name AS draft_name,
              p.id AS project_id, p.name AS project_name, p.agency_client_id
         FROM crm_cp_publish_items i
         JOIN crm_cp_video_versions v ON v.id = i.video_version_id
         JOIN crm_cp_video_drafts d ON d.id = v.draft_id
         JOIN crm_cp_projects p ON p.id = d.project_id
        WHERE i.id = $1::uuid AND p.tenant_id = $2 AND ${allowed.sql}
        LIMIT 1`,
      [itemId, CP_TENANT_ID, ...allowed.params],
    );
    return result.rows[0] ?? cpThrow(404, { error: 'not_found' });
  }

  private async fileExportHandoff(
    item: Record<string, unknown>,
    scope: CpVideoScope,
  ): Promise<{ status: CpPublishStatus; post_ref: string | null; last_error: string | null }> {
    try {
      const version = await this.videos.getVersion(String(item.video_version_id), scope);
      const ctx = await this.schedulableContext(version);
      assertSchedulable(version, ctx);
      const stored = this.settings ? await this.settings.get() : null;
      const native = nativePublishEnabled(
        stored && typeof stored.publish_native === 'boolean' ? stored.publish_native : null,
      );
      const postRef = resolvePublishPostRef(
        String(item.id),
        String(item.channel ?? ''),
        native,
      );
      if (!native && looksNativeSocialRef(postRef)) {
        return { status: 'failed', post_ref: null, last_error: 'native_disabled' };
      }
      return { status: 'published', post_ref: postRef, last_error: null };
    } catch (error) {
      if (isPublishGateError(error)) throw error;
      return { status: 'failed', post_ref: null, last_error: handoffError(error) };
    }
  }

  private async persistOutcome(
    item: Record<string, unknown>,
    outcome: { status: CpPublishStatus; post_ref: string | null; last_error: string | null },
  ): Promise<Record<string, unknown> & { kind: 'video' }> {
    const result = await this.db.query(
      `UPDATE crm_cp_publish_items
          SET status = $1, post_ref = $2, last_error = $3
        WHERE id = $4::uuid
        RETURNING *`,
      [outcome.status, outcome.post_ref, outcome.last_error, item.id],
    );
    return { ...(result.rows[0] ?? cpThrow(500, { error: 'update_failed' })), kind: 'video' };
  }

  private async resolveBulkVersionIds(input: CpBulkInput, scope: CpVideoScope): Promise<string[]> {
    const ids: string[] = [];
    for (const value of input.video_version_ids ?? []) {
      const id = String(value ?? '').trim();
      if (isUuid(id) && !ids.includes(id)) ids.push(id);
    }
    const batchIds = (input.batch_item_ids ?? [])
      .map((value) => String(value ?? '').trim())
      .filter((id) => isUuid(id));
    if (batchIds.length) {
      const allowed = projectScope(scope, 3);
      const result = await this.db.query(
        `SELECT i.id, i.row_json
           FROM crm_cp_batch_items i
           JOIN crm_cp_batch_jobs b ON b.id = i.batch_id
           LEFT JOIN crm_cp_projects p ON p.id = b.project_id
          WHERE i.id = ANY($1::uuid[])
            AND (b.project_id IS NULL OR (p.tenant_id = $2 AND ${allowed.sql}))`,
        [batchIds, CP_TENANT_ID, ...allowed.params],
      );
      for (const row of result.rows) {
        const versionId = versionIdFromBatch(row);
        if (versionId && !ids.includes(versionId)) ids.push(versionId);
      }
    }
    return ids;
  }

  private async insertPublishItem(input: {
    versionId: string;
    channel: string;
    profileId: string;
    scheduledAt: string | null;
    tz: string;
    copy: string | null;
    hashtags: string | null;
    thumbnailAssetId: string | null;
    cta: string | null;
    utmJson: unknown;
    audience: string | null;
    compliance: string | null;
    status: CpPublishStatus;
  }): Promise<Record<string, unknown> & { kind: 'video' }> {
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
        input.versionId,
        input.channel,
        input.profileId,
        input.scheduledAt,
        input.tz,
        input.copy,
        input.hashtags,
        input.thumbnailAssetId,
        input.cta,
        JSON.stringify(input.utmJson ?? null),
        input.audience,
        input.status,
        input.compliance,
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
    const assetIds = await this.resolveUsedAssetIds(version);
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

  private async resolveUsedAssetIds(version: Record<string, unknown>): Promise<string[]> {
    const refs = extractUsedAssetRefs(version);
    const resolved = new Set(refs.assetIds);
    if (refs.versionIds.length) {
      const lookup = await this.db.query(
        `SELECT id, asset_id FROM crm_cp_asset_versions WHERE id = ANY($1::uuid[])`,
        [refs.versionIds],
      );
      for (const row of lookup.rows) {
        const assetId = String(row.asset_id ?? '').trim();
        if (isUuid(assetId)) resolved.add(assetId);
      }
    }
    return [...resolved];
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

function extractUsedAssetRefs(version: Record<string, unknown>): {
  assetIds: string[];
  versionIds: string[];
} {
  const snapshot = objectValue(version.snapshot_json);
  const assetIds = new Set<string>();
  const versionIds = new Set<string>();
  const add = (set: Set<string>, value: unknown) => {
    const id = String(value ?? '').trim();
    if (isUuid(id)) set.add(id);
  };

  const take = (item: unknown, treatIdAsVersion: boolean) => {
    if (typeof item === 'string') {
      add(treatIdAsVersion ? versionIds : assetIds, item);
      return;
    }
    if (!item || typeof item !== 'object') return;
    const obj = item as Record<string, unknown>;
    if (obj.asset_id != null) add(assetIds, obj.asset_id);
    if (obj.asset_version_id != null) add(versionIds, obj.asset_version_id);
    if (obj.id != null && obj.asset_id == null) {
      add(treatIdAsVersion ? versionIds : assetIds, obj.id);
    }
  };

  if (Array.isArray(snapshot.asset_versions)) {
    for (const item of snapshot.asset_versions) take(item, true);
  }
  if (Array.isArray(snapshot.asset_ids)) {
    for (const item of snapshot.asset_ids) take(item, false);
  }
  if (snapshot.asset_version_id != null) add(versionIds, snapshot.asset_version_id);
  if (snapshot.asset_id != null) add(assetIds, snapshot.asset_id);
  return { assetIds: [...assetIds], versionIds: [...versionIds] };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

function isPublishGateError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = Number(
    (error as { status?: unknown; statusCode?: unknown }).status
    ?? (error as { statusCode?: unknown }).statusCode
    ?? (error instanceof HttpException ? error.getStatus() : 0),
  );
  const code = String((error as { error?: unknown }).error ?? '');
  return status === 409 && [
    'not_final_approved',
    'qc_blocked',
    'rights_blocked',
    'disclaimer_required',
  ].includes(code);
}

function handoffError(error: unknown): string {
  if (error && typeof error === 'object' && 'error' in error) {
    return String((error as { error: unknown }).error);
  }
  if (error instanceof Error && error.message) return error.message;
  return 'handoff_failed';
}

function versionIdFromBatch(row: Record<string, unknown>): string | null {
  const direct = nullableText(row.video_version_id);
  if (direct && isUuid(direct)) return direct;
  const json = parseMaybeJson(row.row_json);
  const nested = nullableText(json.video_version_id);
  return nested && isUuid(nested) ? nested : null;
}

function parseMaybeJson(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return objectValue(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return objectValue(value);
}

function ymdInTz(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function isoWeekdayFromYmd(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCDay() === 0 ? 7 : utc.getUTCDay();
}

function addYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function parseHm(value: string): [number, number] {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!match) return [9, 0];
  return [Number(match[1]), Number(match[2])];
}

function slotsOnDay(
  ymd: string,
  count: number,
  windows: Array<{ start: string; end: string }>,
  tz: string,
): string[] {
  if (count <= 0) return [];
  const out: string[] = [];
  const perWindow = Math.ceil(count / windows.length);
  let remaining = count;
  for (const window of windows) {
    const take = Math.min(perWindow, remaining);
    const [startH, startM] = parseHm(window.start);
    const [endH, endM] = parseHm(window.end);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    const span = Math.max(endMin - startMin, 60);
    const step = take > 1 ? span / take : 0;
    for (let index = 0; index < take; index += 1) {
      const mins = startMin + Math.round(step * index);
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      out.push(datetimeLocalInTz(`${ymd}T${hh}:${mm}`, tz));
    }
    remaining -= take;
  }
  return out;
}

function optionalTimestamp(value: unknown, tz = CP_DEFAULT_TZ): string | null {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text)) {
    return datetimeLocalInTz(text, tz);
  }
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) cpThrow(400, { error: 'invalid_scheduled_at' });
  return new Date(timestamp).toISOString();
}

export function datetimeLocalInTz(local: string, tz = CP_DEFAULT_TZ): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(local).trim());
  if (!match) cpThrow(400, { error: 'invalid_scheduled_at' });
  const naiveUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  );
  const offset = tzOffsetMs(new Date(naiveUtc), tz);
  return new Date(naiveUtc - tzOffsetMs(new Date(naiveUtc - offset), tz)).toISOString();
}

function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => (
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  );
  const hour = read('hour') === 24 ? 0 : read('hour');
  const asLocal = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    hour,
    read('minute'),
    read('second'),
  );
  return asLocal - instant.getTime();
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
