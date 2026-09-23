import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  defaultLeadSlaSettingsPayload,
  mergeLeadSlaSettingsPayload,
  type LeadSlaSettingsPayload,
} from './lead-sla-settings.defaults';
import {
  LeadSlaSettingsRepository,
  type LeadSlaPoolStaffRow,
  type LeadSlaRevisionRow,
  type LeadSlaSettingsRow,
} from './lead-sla-settings.repository';
import {
  assertCanEnableReassign,
  assertPublishNote,
  assertValidLeadSlaSettings,
  previewImpactCopy,
} from './lead-sla-settings.validate';
import { computeFr1DueAt } from './lead-sla-working-hours.util';

export type LeadSlaSettingsResponse = {
  tenant_id: string;
  payload: LeadSlaSettingsPayload;
  draft_payload: LeadSlaSettingsPayload | null;
  settings_version: number;
  published_at: string | null;
  updated_by: string;
  updated_at: string;
  pool: LeadSlaPoolStaffRow[];
  can_edit: boolean;
  can_publish: boolean;
  allow_hold_recalc: boolean;
};

@Injectable()
export class LeadSlaSettingsService {
  constructor(private readonly repo: LeadSlaSettingsRepository) {}

  async getPublishedPayload(tenantId = 'default'): Promise<LeadSlaSettingsPayload> {
    const row = await this.repo.getActive(tenantId);
    return row.payload;
  }

  async getSettings(
    tenantId: string,
    caps: { canEdit: boolean; canPublish: boolean },
  ): Promise<LeadSlaSettingsResponse> {
    const row = await this.repo.getActive(tenantId);
    const pool = caps.canEdit || caps.canPublish ? await this.repo.listPoolStaff() : [];
    return this.toResponse(row, pool, caps);
  }

  private toResponse(
    row: LeadSlaSettingsRow,
    pool: LeadSlaPoolStaffRow[],
    caps: { canEdit: boolean; canPublish: boolean },
  ): LeadSlaSettingsResponse {
    return {
      tenant_id: row.tenant_id,
      payload: row.payload,
      draft_payload: row.draft_payload,
      settings_version: row.settings_version,
      published_at: row.published_at,
      updated_by: row.updated_by,
      updated_at: row.updated_at,
      pool,
      can_edit: caps.canEdit,
      can_publish: caps.canPublish,
      allow_hold_recalc: Boolean(row.payload.feature_flags.allow_hold_recalc),
    };
  }

  async saveDraftOrPreview(
    tenantId: string,
    body: {
      payload?: Partial<LeadSlaSettingsPayload> | LeadSlaSettingsPayload;
      publish?: boolean;
      note?: string;
      override_dry_run?: boolean;
    },
    actor: string,
    opts: { canPublish: boolean; isSuperAdmin: boolean },
  ): Promise<LeadSlaSettingsResponse & { preview_impact?: string[]; revision?: LeadSlaRevisionRow }> {
    const current = await this.repo.getActive(tenantId);
    const merged = mergeLeadSlaSettingsPayload(
      { ...current.payload, ...(body.payload ?? {}), settings_version: current.settings_version },
      current.settings_version,
    );
    assertValidLeadSlaSettings(merged);

    if (body.publish) {
      if (!opts.canPublish) {
        throw new ForbiddenException({ error: 'missing_cap', message: 'Publish requires GĐKD or SUPER-ADMIN' });
      }
      return this.publish(tenantId, {
        payload: merged,
        note: body.note ?? '',
        override_dry_run: Boolean(body.override_dry_run),
      }, actor, opts);
    }

    const row = await this.repo.saveDraft(tenantId, merged, actor);
    const pool = await this.repo.listPoolStaff();
    return {
      ...this.toResponse(row, pool, { canEdit: true, canPublish: opts.canPublish }),
      preview_impact: previewImpactCopy(current.payload, merged),
    };
  }

  async publish(
    tenantId: string,
    body: {
      payload?: LeadSlaSettingsPayload | Partial<LeadSlaSettingsPayload>;
      note: string;
      override_dry_run?: boolean;
      reset_defaults?: boolean;
      action?: string;
    },
    actor: string,
    opts: { canPublish: boolean; isSuperAdmin: boolean },
  ): Promise<LeadSlaSettingsResponse & { preview_impact: string[]; revision: LeadSlaRevisionRow }> {
    if (!opts.canPublish) {
      throw new ForbiddenException({ error: 'missing_cap', message: 'Publish requires GĐKD or SUPER-ADMIN' });
    }
    assertPublishNote(body.note);
    const current = await this.repo.getActive(tenantId);
    const source = body.reset_defaults
      ? defaultLeadSlaSettingsPayload(current.settings_version)
      : body.payload
        ? mergeLeadSlaSettingsPayload(
            { ...current.payload, ...body.payload },
            current.settings_version,
          )
        : current.draft_payload ?? current.payload;

    const next = mergeLeadSlaSettingsPayload(source, current.settings_version);
    assertValidLeadSlaSettings(next);
    assertCanEnableReassign(current.payload, next, {
      overrideDryRun: Boolean(body.override_dry_run),
      isSuperAdmin: opts.isSuperAdmin,
    });

    const action =
      body.action ?? (body.reset_defaults ? 'reset_defaults' : 'publish');
    const { row, revision } = await this.repo.publish(
      tenantId,
      next,
      body.note,
      actor,
      action,
    );
    const pool = await this.repo.listPoolStaff();
    return {
      ...this.toResponse(row, pool, { canEdit: true, canPublish: true }),
      preview_impact: previewImpactCopy(current.payload, row.payload),
      revision,
    };
  }

  async listRevisions(tenantId: string, limit?: number, offset?: number) {
    return this.repo.listRevisions(tenantId, limit, offset);
  }

  async rollback(
    tenantId: string,
    revisionId: number,
    note: string,
    actor: string,
    opts: { canPublish: boolean; isSuperAdmin: boolean },
  ) {
    if (!opts.canPublish) {
      throw new ForbiddenException({ error: 'missing_cap' });
    }
    assertPublishNote(note);
    const rev = await this.repo.getRevision(revisionId);
    if (!rev) throw new NotFoundException({ error: 'revision_not_found' });
    const out = await this.publish(
      tenantId,
      {
        payload: rev.payload,
        note,
        override_dry_run: opts.isSuperAdmin,
        action: 'rollback',
      },
      actor,
      opts,
    );
    return { ...out, rolled_back_from: revisionId };
  }

  async setAcceptsLeads(staffId: number, accepts: boolean, opts: { canEdit: boolean }) {
    if (!opts.canEdit) throw new ForbiddenException({ error: 'missing_cap' });
    const row = await this.repo.setAcceptsLeads(staffId, accepts);
    if (!row) throw new NotFoundException({ error: 'staff_not_found' });
    return { staff: { ...row, accepts_leads: accepts } };
  }

  async recalcHold(
    body: { dry_run?: boolean; lead_ids?: number[] },
    opts: { isSuperAdmin: boolean; allowHoldRecalc: boolean },
  ) {
    if (!opts.isSuperAdmin) {
      throw new ForbiddenException({ error: 'super_admin_required' });
    }
    if (!opts.allowHoldRecalc) {
      throw new ForbiddenException({
        error: 'allow_hold_recalc_disabled',
        message: 'Recalc hold is hidden unless feature_flags.allow_hold_recalc=true',
      });
    }
    const preview = await this.repo.previewRecalcHold(body.lead_ids ?? null);
    return {
      dry_run: body.dry_run !== false,
      would_touch: preview.length,
      leads: preview,
      applied: false,
      note: 'v1 dry preview only — full recalc ships with P10.b hold recompute',
    };
  }

  /**
   * LOCKED §16.6 — call on new assign / reassign only.
   * Does not mutate fr1_due_at for existing leads when settings change.
   */
  async applyFr1OnNewAssign(
    leadId: number,
    assignedAt: Date = new Date(),
    opts?: { source?: string; tags?: string[] },
  ): Promise<void> {
    const payload = await this.getPublishedPayload();
    const due = computeFr1DueAt(
      assignedAt,
      payload.fr1_hours,
      payload.working_hours,
      payload.holidays,
    );
    const source = String(opts?.source ?? '').toLowerCase();
    const tags = (opts?.tags ?? []).map((t) => String(t).toLowerCase());
    const isHot =
      payload.hot_rules.sources.map((s) => s.toLowerCase()).includes(source) ||
      payload.hot_rules.tags.some((t) => tags.includes(t.toLowerCase()));
    await this.repo.applyFr1OnAssign(
      leadId,
      due,
      null,
      payload.settings_version,
      isHot,
    );
  }
}
