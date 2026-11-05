import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { B2bProjectsService } from '../b2b-projects/b2b-projects.service';
import { kpiHubMemory } from '../kpi-hub/kpi-hub.memory-store';
import { KpiHubTargetsService } from '../kpi-hub/targets/kpi-hub-targets.service';
import { DeliveryBudgetRepository } from './delivery-budget.repository';
import {
  DEFAULT_MIN_GROSS_MARGIN_PCT,
  financeApprovalRequired,
  parseDecimal,
  validateManualAlloc,
} from './delivery-budget.util';
import { DeliveryProjectKpisRepository } from './delivery-project-kpis.repository';
import { assertKpisAttachable } from './delivery-project-kpis.util';
import { DeliveryProjectsRepository } from './delivery-projects.repository';
import type {
  AttachProjectKpisBody,
  BudgetItemBody,
  CreateDeliveryBody,
  PatchDeliveryBody,
  ResourceBody,
  SaveWizardBody,
  SubmitDeliveryBody,
} from './delivery-projects.types';
import {
  deriveDeliveryHealth,
  hasCapability,
  hasCircularMilestoneDeps,
  nextPrjCode,
  normalizeCapabilities,
} from './delivery-projects.util';

@Injectable()
export class DeliveryProjectsService {
  constructor(
    private readonly repo: DeliveryProjectsRepository,
    private readonly budgetRepo: DeliveryBudgetRepository,
    private readonly b2bProjects: B2bProjectsService,
    private readonly kpisRepo: DeliveryProjectKpisRepository,
    private readonly targets: KpiHubTargetsService,
  ) {}

  async list(filters: { capability?: string; q?: string; status?: string }) {
    const items = await this.repo.list({
      capability: (filters.capability as CreateDeliveryBody['capabilities'][number] | 'all' | 'both') ?? 'all',
      q: filters.q,
      status: filters.status,
    });
    return { items };
  }

  async get(id: string) {
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  async create(body: CreateDeliveryBody, actorStaffId: number, canManageB2b: boolean) {
    const caps = normalizeCapabilities(body.capabilities);
    if (caps.length === 0) {
      throw new BadRequestException({ error: 'capabilities_required' });
    }

    let b2bProjectId: string | null = null;
    let ingestStatus: string | null = null;

    if (hasCapability(caps, 'lead_ingest')) {
      if (!canManageB2b) {
        throw new ForbiddenException({ error: 'missing_cap', section: 'crm_b2b_projects' });
      }
      const code = body.b2b?.code?.trim().toLowerCase();
      if (!code) {
        throw new BadRequestException({ error: 'b2b_code_required' });
      }
      const b2b = await this.b2bProjects.create({
        code,
        name: body.b2b?.name?.trim() || body.name.trim(),
        status: body.b2b?.status,
        ai_call_enabled: body.b2b?.ai_call_enabled,
        manual_ingest_enabled: body.b2b?.manual_ingest_enabled,
      });
      b2bProjectId = b2b.id;
      ingestStatus = b2b.status;
    }

    let code: string | null = null;
    if (hasCapability(caps, 'delivery')) {
      if (!body.name.trim() || body.name.trim().length < 3) {
        throw new BadRequestException({ error: 'name_too_short' });
      }
      if (body.pm_staff_id == null) {
        throw new BadRequestException({ error: 'pm_required' });
      }
      code = nextPrjCode(await this.repo.listPrjCodes());
    }

    const todayIso = new Date().toISOString();
    const health = deriveDeliveryHealth({
      capabilities: caps,
      ingestStatus: ingestStatus as 'draft' | 'active' | 'paused' | 'archived' | null,
      todayIso,
      milestones: [],
    });

    return this.repo.insertHeader({
      name: body.name.trim(),
      capabilities: caps,
      code: hasCapability(caps, 'delivery') ? code : null,
      b2b_project_id: b2bProjectId,
      status: 'draft',
      customer_id: body.customer_id ?? null,
      project_type: body.project_type,
      priority: body.priority,
      pm_staff_id: body.pm_staff_id ?? null,
      am_staff_id: body.am_staff_id ?? null,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      description: body.description,
      health_status: health.health,
      health_components_json: health.components,
      created_by_staff_id: actorStaffId,
    });
  }

  async patch(id: string, body: PatchDeliveryBody) {
    await this.get(id);
    const row = await this.repo.patchHeader(id, body as Record<string, unknown>);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    return row;
  }

  async backfill(actorStaffId: number) {
    return this.repo.backfillFromB2b(actorStaffId);
  }

  async saveWizard(id: string, body: SaveWizardBody) {
    const row = await this.get(id);
    const caps = normalizeCapabilities(row.capabilities);

    if (body.step >= 2 && !hasCapability(caps, 'delivery')) {
      throw new BadRequestException({ error: 'delivery_required' });
    }

    const deps = body.deps ?? [];
    if (deps.length > 0 && hasCircularMilestoneDeps(deps)) {
      throw new BadRequestException({ error: 'circular_milestone_deps' });
    }

    if (body.services) {
      await this.repo.replaceServices(id, body.services);
    }
    if (body.deliverables) {
      await this.repo.replaceDeliverables(id, body.deliverables);
    }
    if (body.milestones) {
      await this.repo.replaceMilestones(id, body.milestones, deps);
    }

    if (body.step >= 4) {
      await this.budgetRepo.updateProjectBudgetHeader(id, {
        contract_budget: body.contract_budget,
        contingency_amount: body.contingency_amount,
        finance_policy_json: body.finance_policy_json,
      });
      await this.budgetRepo.recalcProjectBudget(id);
    }

    await this.repo.upsertWizardDraft(id, body.step, body.state_json ?? {});

    const milestones = await this.repo.listMilestones(id);
    const health = deriveDeliveryHealth({
      capabilities: caps,
      ingestStatus: row.ingest_status ?? null,
      todayIso: new Date().toISOString(),
      milestones,
    });
    await this.repo.updateHealth(id, health.health, health.components);

    return this.get(id);
  }

  validateDeps(deps: Array<{ from: string; to: string }>) {
    const circular = hasCircularMilestoneDeps(deps);
    return { ok: !circular, circular };
  }

  async listBudgetItems(projectId: string) {
    await this.get(projectId);
    const items = await this.budgetRepo.listItems(projectId);
    const header = await this.budgetRepo.getProjectBudgetHeader(projectId);
    return { items, header };
  }

  async previewBudgetImpact(projectId: string, draft: BudgetItemBody) {
    await this.get(projectId);
    this.validateBudgetItem(draft);
    return this.budgetRepo.previewImpact(projectId, draft);
  }

  async createBudgetItem(projectId: string, body: BudgetItemBody) {
    await this.get(projectId);
    this.validateBudgetItem(body);
    if (body.allocation_method === 'manual' && body.manual_allocs) {
      const check = validateManualAlloc(body.forecast, body.manual_allocs);
      if (!check.ok) {
        throw new BadRequestException({
          code: 'ALLOC_SUM_MISMATCH',
          field_errors: { amount: 'Tổng phân bổ phải bằng forecast' },
        });
      }
    }
    const item = await this.budgetRepo.insertItem(projectId, body);
    await this.budgetRepo.recalcProjectBudget(projectId);
    return item;
  }

  async listResources(projectId: string) {
    await this.get(projectId);
    const items = await this.budgetRepo.listResources(projectId);
    return { items };
  }

  async createResource(projectId: string, body: ResourceBody) {
    await this.get(projectId);
    const header = await this.budgetRepo.getProjectBudgetHeader(projectId);
    const policy = header?.finance_policy_json ?? {};
    const blockOver = Boolean(policy.block_over_capacity);
    const overlap = await this.budgetRepo.sumStaffOverlap(
      body.staff_id,
      { start: body.start_date, end: body.end_date },
      projectId,
    );
    const newPct = Number(body.allocation_pct);
    const total = overlap + newPct;
    if (total > 100) {
      if (blockOver) {
        throw new BadRequestException({ error: 'CAPACITY_BLOCKED' });
      }
      if (!body.overload_reason?.trim()) {
        throw new BadRequestException({
          error: 'overload_reason_required',
          field_errors: { overload_reason: 'Cần lý do khi phân bổ vượt 100%' },
        });
      }
    }
    return this.budgetRepo.insertResource(projectId, body);
  }

  private validateBudgetItem(body: BudgetItemBody) {
    if (body.kind === 'media' && !body.media_borne) {
      throw new BadRequestException({
        error: 'media_borne_required',
        field_errors: { media_borne: 'Media phải chọn agency_borne hoặc client_borne' },
      });
    }
    if (parseDecimal(body.forecast) == null) {
      throw new BadRequestException({ error: 'invalid_forecast' });
    }
  }

  private async financeGate(projectId: string, actorCaps: Record<string, string[]>) {
    await this.budgetRepo.recalcProjectBudget(projectId);
    const header = await this.budgetRepo.getProjectBudgetHeader(projectId);
    if (!header) return { requireFinance: false, needs_finance: false };

    const policy = header.finance_policy_json ?? {};
    const minMargin = Number(policy.min_gross_margin_pct ?? DEFAULT_MIN_GROSS_MARGIN_PCT);
    const approval = financeApprovalRequired({
      marginPct: header.gross_margin_pct,
      minMargin,
      forecast: header.forecast_cost ?? '0',
      budget: header.internal_cost_budget ?? '0',
    });
    const hasApprove = (actorCaps.crm_delivery_budget ?? []).includes('approve');
    return {
      requireFinance: approval.requireFinance,
      needs_finance: approval.requireFinance && !hasApprove,
    };
  }

  async listKpis(projectId: string) {
    await this.get(projectId);
    const items = await this.kpisRepo.list(projectId);
    return { items };
  }

  async attachKpis(projectId: string, body: AttachProjectKpisBody) {
    await this.get(projectId);
    const dictionaryIds = [...new Set(body.dictionary_ids ?? [])];
    if (dictionaryIds.length === 0) {
      throw new BadRequestException({ error: 'dictionary_ids_required' });
    }

    const dictRows = dictionaryIds.map((id) => {
      const dict = kpiHubMemory.dictionary.find((d) => d.id === id);
      if (!dict) throw new NotFoundException({ error: 'dictionary_not_found', dictionary_id: id });
      return { dictionary_id: id, status: dict.status, dict };
    });

    if (dictRows.some((r) => r.status === 'DEPRECATED')) {
      throw new BadRequestException({ error: 'KPI_DEPRECATED' });
    }
    if (dictRows.some((r) => r.status !== 'ACTIVE')) {
      throw new BadRequestException({ error: 'KPI_STATUS_INVALID' });
    }

    const existing = await this.kpisRepo.listDictionaryIds(projectId);
    const validation = assertKpisAttachable(
      dictRows.map((r) => ({ dictionary_id: r.dictionary_id, status: r.status })),
      existing,
    );
    if (!validation.ok) {
      throw new BadRequestException({ error: validation.code ?? 'KPI_DUPLICATE', errors: validation.errors });
    }

    const period = new Date().toISOString().slice(0, 7);
    const toInsert: Array<{
      dictionary_id: string;
      kpi_version_id?: string | null;
      target_id?: string | null;
      inherit_alert?: boolean;
    }> = [];

    for (const row of dictRows) {
      let targetId: string | null = null;
      if (body.create_draft_targets) {
        const target = await this.targets.upsert({
          dictionary_id: row.dictionary_id,
          period,
          scope_type: 'PROJECT',
          scope_label: projectId,
          scope_project_id: projectId,
          target_value: 0,
          alerts_enabled: body.inherit_alerts ?? true,
        });
        targetId = target.id;
      }
      toInsert.push({
        dictionary_id: row.dictionary_id,
        kpi_version_id: row.dict.current_version > 0 ? `${row.dict.id}-v${row.dict.current_version}` : null,
        target_id: targetId,
        inherit_alert: body.inherit_alerts ?? true,
      });
    }

    const items = await this.kpisRepo.addMany(projectId, toInsert);
    return { items, count: items.length };
  }

  async submit(projectId: string, body: SubmitDeliveryBody, actorCaps: Record<string, string[]> = {}) {
    const row = await this.get(projectId);
    const kpis = await this.kpisRepo.list(projectId);
    if (kpis.length === 0 && !body.skip_kpi_reason?.trim()) {
      throw new BadRequestException({ error: 'kpi_or_skip_reason_required' });
    }

    const checklist = body.checklist ?? {};
    const required = ['scope_confirmed', 'budget_confirmed', 'kpi_confirmed'];
    for (const key of required) {
      if (!checklist[key]) {
        throw new BadRequestException({ error: 'checklist_incomplete', field: key });
      }
    }

    const finance = await this.financeGate(projectId, actorCaps);

    await this.repo.upsertWizardDraft(projectId, 5, {
      skip_kpi_reason: body.skip_kpi_reason ?? null,
      checklist,
      cadence_json: body.cadence_json ?? {},
      kpi_count: kpis.length,
      submitted_at: new Date().toISOString(),
      needs_finance: finance.needs_finance,
    });

    const status = finance.requireFinance ? 'pending_approval' : 'approved';
    const updated = await this.repo.patchHeader(projectId, { status });
    if (!updated) throw new NotFoundException({ error: 'not_found' });
    if (finance.needs_finance) {
      await this.budgetRepo.submitProject(projectId, { status: 'pending_approval', needs_finance: true });
    }
    void row;
    return { ...updated, kpi_count: kpis.length, needs_finance: finance.needs_finance };
  }
}
