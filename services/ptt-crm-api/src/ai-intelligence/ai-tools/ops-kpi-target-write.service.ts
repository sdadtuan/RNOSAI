import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OpsCrmContextRepository } from './ops-crm-context.repository';
import { OpsRoleKpiRepository } from './ops-role-kpi.repository';
import {
  isRoleKpiKey,
  isRoleKpiStatus,
  OpsKpiTargetBatchWriteResult,
  OpsKpiTargetReadResult,
  OpsKpiTargetWriteMeta,
  OpsKpiTargetWriteResult,
  OpsRoleKpiTargetRow,
  ROLE_KPI_EDITABLE_STATUSES,
  RoleKpiStatus,
} from './ops-kpi-target.types';

const BATCH_MAX = 50;

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function optionalStr(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s ? s : undefined;
}

function optionalDate(raw: unknown): string | undefined {
  const s = optionalStr(raw);
  if (!s) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new BadRequestException({ error: 'period_invalid', value: s });
  }
  return s;
}

function optionalNumber(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new BadRequestException({ error: 'period_invalid', message: 'target_value must be numeric or null' });
  }
  return n;
}

@Injectable()
export class OpsKpiTargetWriteService {
  constructor(
    private readonly repo: OpsRoleKpiRepository,
    private readonly crmRepo: OpsCrmContextRepository,
  ) {}

  async writeDraft(
    input: Record<string, unknown>,
    meta: OpsKpiTargetWriteMeta,
    opts: { humanApproved: boolean },
  ): Promise<OpsKpiTargetWriteResult | OpsKpiTargetBatchWriteResult> {
    if (!opts.humanApproved) {
      throw new ForbiddenException({
        error: 'human_approval_required',
        tool_name: 'kpi_target.write_draft',
        message:
          'kpi_target.write_draft requires human approval (X-AI-Human-Approved: 1).',
      });
    }

    const itemsRaw = input.items;
    if (Array.isArray(itemsRaw)) {
      if (itemsRaw.length > BATCH_MAX) {
        throw new BadRequestException({
          error: 'batch_limit_exceeded',
          max: BATCH_MAX,
          count: itemsRaw.length,
        });
      }
      if (itemsRaw.length === 0) {
        throw new BadRequestException({ error: 'items_required' });
      }
      const results: OpsKpiTargetWriteResult[] = [];
      for (const item of itemsRaw) {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const merged = { ...input, ...row };
        delete merged.items;
        results.push(await this.writeOne(merged, meta));
      }
      const planId = positiveInt(input.plan_id ?? input.planId);
      return {
        ok: true,
        wired: true,
        phase: 'P5-KPI',
        status: 'persisted',
        items: results,
        kpi_target_ids: results.map((r) => r.kpi_target_id),
        links: [
          planId != null
            ? `/crm/kpi-hub/role-kpi?plan_id=${planId}`
            : '/crm/kpi-hub/role-kpi',
        ],
      };
    }

    return this.writeOne(input, meta);
  }

  async read(input: Record<string, unknown>): Promise<OpsKpiTargetReadResult> {
    const planId = positiveInt(input.plan_id ?? input.planId);
    const lifecycleId = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    const clientId = optionalStr(input.client_id ?? input.clientId);
    const roleKey = optionalStr(input.role_key ?? input.roleKey)?.toLowerCase();
    const status = optionalStr(input.status)?.toLowerCase();

    if (roleKey && !isRoleKpiKey(roleKey)) {
      throw new BadRequestException({ error: 'role_key_invalid', role_key: roleKey });
    }
    if (status && !isRoleKpiStatus(status)) {
      throw new BadRequestException({ error: 'period_invalid', status });
    }

    const rows = await this.repo.list({
      plan_id: planId,
      lifecycle_id: lifecycleId,
      client_id: clientId,
      role_key: roleKey,
      status,
      limit: positiveInt(input.limit) ?? 100,
    });

    const known: string[] = [`rows:${rows.length}`];
    const assumed: string[] = [];
    const unknown: string[] = [];
    for (const row of rows) {
      known.push(`${row.role_key}.${row.kpi_key}:${row.status}`);
      if (row.target_value == null || row.form_data?.unknown_target === true) {
        unknown.push(`${row.role_key}.${row.kpi_key}:target`);
      }
      if (row.actual_value == null) {
        assumed.push(`${row.role_key}.${row.kpi_key}:actual_unset`);
      }
    }

    const links =
      planId != null
        ? [`/crm/kpi-hub/role-kpi?plan_id=${planId}`]
        : ['/crm/kpi-hub/role-kpi'];

    return {
      ok: true,
      wired: true,
      phase: 'P5-KPI',
      tool: 'kpi_target.read',
      rows,
      known: [...new Set(known)],
      assumed: [...new Set(assumed)],
      unknown: [...new Set(unknown)],
      links,
    };
  }

  /** Staff UI: draft→review or review→approved (never AI). Never sets actual. */
  async transitionStatus(
    id: number,
    toStatus: RoleKpiStatus,
    actor: string,
  ): Promise<OpsRoleKpiTargetRow> {
    const row = await this.repo.getById(id);
    if (!row) {
      throw new NotFoundException({ error: 'kpi_not_found', id });
    }
    const from = row.status;
    const allowed =
      (from === 'draft' && toStatus === 'review') ||
      (from === 'review' && toStatus === 'approved') ||
      (from === 'draft' && toStatus === 'cancelled') ||
      (from === 'review' && toStatus === 'cancelled');
    if (!allowed) {
      throw new ConflictException({
        error: 'kpi_not_editable',
        from_status: from,
        to_status: toStatus,
      });
    }
    const updated = await this.repo.patch(id, {
      status: toStatus,
      form_data: {
        status_changed_by: actor,
        status_changed_at: new Date().toISOString(),
        previous_status: from,
      },
    });
    if (!updated) throw new NotFoundException({ error: 'kpi_not_found', id });
    return updated;
  }

  /**
   * Staff UI patch for draft/review rows: target, owner, due (period_end).
   * Never sets actual_value or approved/locked status.
   */
  async patchDraftFields(
    id: number,
    body: {
      target_value?: number | null;
      owner_staff_id?: string | null;
      due_date?: string | null;
      period_end?: string | null;
      notes?: string;
    },
    actor: string,
  ): Promise<OpsRoleKpiTargetRow> {
    const row = await this.repo.getById(id);
    if (!row) {
      throw new NotFoundException({ error: 'kpi_not_found', id });
    }
    if (!ROLE_KPI_EDITABLE_STATUSES.has(row.status)) {
      throw new ConflictException({
        error: 'kpi_not_editable',
        id,
        status: row.status,
      });
    }

    const patch: {
      target_value?: number | null;
      owner_staff_id?: string | null;
      period_end?: string | null;
      notes?: string;
      form_data: Record<string, unknown>;
    } = {
      form_data: {
        staff_edited_by: actor,
        staff_edited_at: new Date().toISOString(),
      },
    };

    if (body.target_value !== undefined) {
      const tv = optionalNumber(body.target_value);
      patch.target_value = tv === undefined ? null : tv;
      patch.form_data.unknown_target = patch.target_value == null;
    }
    if (body.owner_staff_id !== undefined) {
      const owner =
        body.owner_staff_id == null ? null : String(body.owner_staff_id).trim() || null;
      patch.owner_staff_id = owner;
    }
    const dueRaw = body.due_date !== undefined ? body.due_date : body.period_end;
    if (dueRaw !== undefined) {
      if (dueRaw == null || dueRaw === '') {
        patch.period_end = null;
      } else {
        patch.period_end = optionalDate(dueRaw) ?? null;
      }
      if (patch.period_end && row.period_start && patch.period_end < row.period_start) {
        throw new BadRequestException({
          error: 'period_invalid',
          period_start: row.period_start,
          period_end: patch.period_end,
        });
      }
    }
    if (body.notes !== undefined) {
      patch.notes = String(body.notes ?? '');
    }

    const updated = await this.repo.patch(id, patch);
    if (!updated) throw new NotFoundException({ error: 'kpi_not_found', id });
    return updated;
  }

  private async writeOne(
    input: Record<string, unknown>,
    meta: OpsKpiTargetWriteMeta,
  ): Promise<OpsKpiTargetWriteResult> {
    // Hard rule: never accept actual from AI write_draft
    if ('actual_value' in input || 'actualValue' in input) {
      // strip silently per SPEC
      delete input.actual_value;
      delete input.actualValue;
    }

    const id = positiveInt(input.id);
    const roleKey = optionalStr(input.role_key ?? input.roleKey)?.toLowerCase();
    if (!roleKey || !isRoleKpiKey(roleKey)) {
      throw new BadRequestException({ error: 'role_key_invalid', role_key: roleKey });
    }

    const kpiKey = optionalStr(input.kpi_key ?? input.kpiKey);
    if (!kpiKey) {
      throw new BadRequestException({ error: 'kpi_key_required' });
    }

    const periodStart = optionalDate(input.period_start ?? input.periodStart);
    const periodEnd = optionalDate(input.period_end ?? input.periodEnd);
    if (periodStart && periodEnd && periodStart > periodEnd) {
      throw new BadRequestException({ error: 'period_invalid', period_start: periodStart, period_end: periodEnd });
    }

    const planId = positiveInt(input.plan_id ?? input.planId);
    if (planId != null) {
      const plan = await this.crmRepo.getPlan(planId);
      if (!plan) {
        throw new NotFoundException({ error: 'plan_not_found', plan_id: planId });
      }
    }

    const targetValue = optionalNumber(input.target_value ?? input.targetValue);
    const formData: Record<string, unknown> = {
      ai_draft: true,
      ai_approved_by: meta.actor,
      ai_approved_at: meta.approvedAt,
      source_tool: 'kpi_target.write_draft',
    };
    if (targetValue === null || targetValue === undefined) {
      formData.unknown_target = true;
    }
    const breakdownLineId = optionalStr(input.breakdown_line_id ?? input.breakdownLineId);
    if (breakdownLineId) formData.breakdown_line_id = breakdownLineId;

    const kpiLabel =
      optionalStr(input.kpi_label ?? input.kpiLabel) ?? kpiKey.replace(/_/g, ' ');
    const targetUnit = optionalStr(input.target_unit ?? input.targetUnit) ?? 'count';
    const notes = optionalStr(input.notes) ?? '';
    const ownerStaffId = optionalStr(input.owner_staff_id ?? input.ownerStaffId) ?? null;
    const upsertKey = optionalStr(input.upsert_key ?? input.upsertKey) ?? null;
    const lifecycleId = positiveInt(input.lifecycle_id ?? input.lifecycleId) ?? null;
    const clientId = optionalStr(input.client_id ?? input.clientId) ?? null;
    const campaignId = positiveInt(input.campaign_id ?? input.campaignId) ?? null;

    let row;
    if (id != null) {
      const existing = await this.repo.getById(id);
      if (!existing) {
        throw new NotFoundException({ error: 'kpi_not_found', id });
      }
      if (!ROLE_KPI_EDITABLE_STATUSES.has(existing.status)) {
        throw new ConflictException({
          error: 'kpi_not_editable',
          id,
          status: existing.status,
        });
      }
      row = await this.repo.patch(id, {
        kpi_label: kpiLabel,
        period_start: periodStart ?? existing.period_start,
        period_end: periodEnd ?? existing.period_end,
        target_value: targetValue === undefined ? existing.target_value : targetValue,
        target_unit: targetUnit,
        owner_staff_id: ownerStaffId,
        notes,
        form_data: formData,
      });
    } else {
      const match = await this.repo.findUpsertMatch({
        plan_id: planId ?? null,
        role_key: roleKey,
        kpi_key: kpiKey,
        upsert_key: upsertKey,
        period_start: periodStart ?? null,
      });
      if (match) {
        if (!ROLE_KPI_EDITABLE_STATUSES.has(match.status)) {
          throw new ConflictException({
            error: 'kpi_not_editable',
            id: match.id,
            status: match.status,
          });
        }
        row = await this.repo.patch(match.id, {
          kpi_label: kpiLabel,
          period_start: periodStart ?? match.period_start,
          period_end: periodEnd ?? match.period_end,
          target_value: targetValue === undefined ? match.target_value : targetValue,
          target_unit: targetUnit,
          owner_staff_id: ownerStaffId,
          notes,
          form_data: formData,
        });
      } else {
        row = await this.repo.insert({
          plan_id: planId ?? null,
          lifecycle_id: lifecycleId,
          client_id: clientId,
          campaign_id: campaignId,
          role_key: roleKey,
          kpi_key: kpiKey,
          kpi_label: kpiLabel,
          period_start: periodStart ?? null,
          period_end: periodEnd ?? null,
          target_value: targetValue === undefined ? null : targetValue,
          target_unit: targetUnit,
          status: 'draft',
          owner_staff_id: ownerStaffId,
          form_data: formData,
          notes,
          upsert_key: upsertKey,
        });
      }
    }

    if (!row) {
      throw new NotFoundException({ error: 'kpi_not_found' });
    }

    return {
      ok: true,
      wired: true,
      phase: 'P5-KPI',
      status: 'persisted',
      kpi_target_id: row.id,
      role_key: row.role_key,
      kpi_key: row.kpi_key,
      kpi_status: row.status,
      links: [
        row.plan_id != null
          ? `/crm/kpi-hub/role-kpi?plan_id=${row.plan_id}`
          : '/crm/kpi-hub/role-kpi',
      ],
    };
  }
}
