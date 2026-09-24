import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  emptyGrowthSections,
  growthFillPct,
  growthSoftWarnings,
  mergeGrowthSections,
  packDefaultsHaveFakeNumbers,
} from './growth-sections.util';
import { PackKind, StrategyPacksRepository } from './strategy-packs.repository';
import { buildGenerateDraft, GENERATE_MODES, GenerateMode } from './strategy-generate.util';
import { buildGrowthExportModel } from './growth-export.util';
import { buildGrowthDocx } from './growth-export-docx.util';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';

function asJson(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function blank(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function isPoolBusy(error: unknown): boolean {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  return code === '53300' || /too many clients/i.test(message);
}

async function withPoolRetry<T>(logger: Logger, label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isPoolBusy(error)) throw error;
    logger.error(`${label} postgres pool busy, retrying read`, error instanceof Error ? error.stack : String(error));
    await new Promise((resolve) => setTimeout(resolve, 300));
    return fn();
  }
}

function finiteOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toPackRef(row: { key: string; is_active: boolean; defaults_json: Record<string, unknown> }) {
  return { key: row.key, is_active: row.is_active, defaults_json: row.defaults_json };
}

function throwGrowth(error: string, message: string): never {
  if (error === 'source_required_for_known' || error.startsWith('invalid_')) {
    throw new BadRequestException({ error, message });
  }
  throw new BadRequestException({ error, message });
}

@Injectable()
export class StrategyPacksService {
  private readonly logger = new Logger(StrategyPacksService.name);

  constructor(private readonly repo: StrategyPacksRepository) {}

  async packsList() {
    const [industry, service] = await Promise.all([
      this.repo.listPacks('industry', true),
      this.repo.listPacks('service', true),
    ]);
    return {
      ok: true,
      industry_packs: industry.map((row) => ({ key: row.key, name_vi: row.name_vi, version: row.version })),
      service_packs: service.map((row) => ({ key: row.key, name_vi: row.name_vi, version: row.version })),
    };
  }

  async packGet(input: { industry_pack_key?: string | null; service_pack_key?: string | null }) {
    const industryKey = String(input.industry_pack_key ?? '').trim();
    const serviceKey = String(input.service_pack_key ?? '').trim();
    if (!industryKey && !serviceKey) {
      throw new BadRequestException({ error: 'pack_key_required', message: 'Cần industry_pack_key hoặc service_pack_key' });
    }
    const industry = industryKey ? await this.requirePack('industry', industryKey) : null;
    const service = serviceKey ? await this.requirePack('service', serviceKey) : null;
    return { ok: true, industry_pack: industry, service_pack: service };
  }

  async listAdmin() {
    const [industry, service] = await Promise.all([
      this.repo.listPacks('industry', false),
      this.repo.listPacks('service', false),
    ]);
    return { industry_packs: industry, service_packs: service };
  }

  async updateAdmin(
    kind: PackKind,
    key: string,
    patch: { defaults_json?: Record<string, unknown>; is_active?: boolean; name_vi?: string },
  ) {
    if (patch.defaults_json) {
      const fake = packDefaultsHaveFakeNumbers(patch.defaults_json);
      if (fake) {
        throw new BadRequestException({
          error: 'pack_numeric_forbidden',
          message: `defaults_json không được ghi số tiền/KPI tại ${fake}`,
        });
      }
    }
    const row = await this.repo.updatePack(kind, key, patch);
    if (!row) throw new NotFoundException({ error: 'pack_not_found', message: key });
    return row;
  }

  async sectionsRead(planId: number) {
    const plan = await this.requirePlan(planId);
    const stored = plan.growth_sections;
    const sections =
      stored && typeof stored === 'object' && !Array.isArray(stored)
        ? ({ ...(stored as Record<string, unknown>) } as Record<string, unknown>)
        : emptyGrowthSections();
    if (sections.schema_version == null) sections.schema_version = 1;
    if (!sections.industry_pack_key && plan.industry_pack_key) {
      sections.industry_pack_key = plan.industry_pack_key;
    }
    if (!sections.service_pack_key && plan.service_pack_key) {
      sections.service_pack_key = plan.service_pack_key;
    }
    return {
      ok: true,
      plan_id: planId,
      growth_sections: sections,
      fill_pct: growthFillPct(sections),
      warnings: growthSoftWarnings(sections),
    };
  }

  async sectionsUpsert(input: {
    planId: number;
    patch: Record<string, unknown>;
    dryRun: boolean;
    humanApproved: boolean;
    actor: string;
  }) {
    if (!input.dryRun && !input.humanApproved) {
      throw new ForbiddenException({
        error: 'human_approval_required',
        message: 'sections_upsert cần X-AI-Human-Approved: 1',
      });
    }
    const plan = await this.requirePlan(input.planId);
    if (plan.status === 'archived') {
      throw new ConflictException({ error: 'plan_archived', message: 'Plan đã lưu trữ' });
    }
    const merged = mergeGrowthSections(plan.growth_sections, input.patch ?? {});
    if (!merged.ok) throwGrowth(merged.error, merged.message);
    if (!input.dryRun) {
      await this.repo.saveGrowth(input.planId, merged.value, input.actor);
    }
    return {
      ok: true,
      dry_run: input.dryRun,
      plan_id: input.planId,
      growth_sections: merged.value,
      fill_pct: growthFillPct(merged.value),
      warnings: [...merged.warnings, ...growthSoftWarnings(merged.value)],
    };
  }

  async setPlanPackKeys(
    planId: number,
    keys: { industry_pack_key?: string | null; service_pack_key?: string | null },
  ) {
    const plan = await this.requirePlan(planId);
    if (plan.status === 'archived') {
      throw new ConflictException({ error: 'plan_archived', message: 'Plan đã lưu trữ' });
    }
    if (keys.industry_pack_key) await this.requirePack('industry', keys.industry_pack_key);
    if (keys.service_pack_key) await this.requirePack('service', keys.service_pack_key);
    await this.repo.setPackKeys(planId, keys);
    return this.requirePlan(planId);
  }

  async generateDraft(input: {
    planId: number;
    lifecycleId?: number | null;
    insightId?: number | null;
    industryPackKey?: string | null;
    servicePackKey?: string | null;
    overwriteMode?: string | null;
    dryRun: boolean;
    persist: boolean;
    humanApproved: boolean;
    actor: string;
  }) {
    const mode = String(input.overwriteMode ?? 'fill_empty_only');
    if (!(GENERATE_MODES as readonly string[]).includes(mode)) {
      throw new BadRequestException({ error: 'invalid_overwrite_mode', message: mode });
    }
    const write = input.persist && !input.dryRun;
    if (write && !input.humanApproved) {
      throw new ForbiddenException({
        error: 'human_approval_required',
        message: 'strategy.generate_draft persist cần X-AI-Human-Approved: 1',
      });
    }
    const loaded = await this.repo.loadGenerateSources(
      input.planId,
      input.lifecycleId ?? null,
      input.insightId ?? null,
    );
    if (!loaded) throw new NotFoundException({ error: 'plan_not_found', message: `plan ${input.planId}` });
    if (String(loaded.plan.status ?? '') === 'archived') {
      throw new ConflictException({ error: 'plan_archived', message: 'Plan đã lưu trữ' });
    }
    const [industryPacks, servicePacks] = await Promise.all([
      this.repo.listPacks('industry', false),
      this.repo.listPacks('service', false),
    ]);
    const framework = asJson(loaded.plan.strategy_framework_json);
    const prof = asJson(loaded.plan.target_market_prof_json);
    const meta = asJson(framework.ai_tmmt_field_meta);
    const tmmtKeys = ['market_context', 'segmentation_icp', 'personas_roles', 'pains_desired_outcomes'];
    const tmmt: Record<string, { text: string; status: string }> = {};
    for (const key of tmmtKeys) {
      const row = asJson(meta[key]);
      tmmt[key] = {
        text: String(row.text ?? row.value ?? prof[key] ?? ''),
        status: String(row.status ?? ''),
      };
    }
    const draft = buildGenerateDraft({
      planId: input.planId,
      lifecycleId: loaded.lifecycleId,
      overwriteMode: mode as GenerateMode,
      requestedIndustryKey: blank(input.industryPackKey),
      requestedServiceKey: blank(input.servicePackKey),
      planIndustryKey: blank(loaded.plan.industry_pack_key),
      planServiceKey: blank(loaded.plan.service_pack_key),
      lifecycleIndustryKey: blank(loaded.lifecycle?.industry_pack_key),
      lifecycleServiceKey: blank(loaded.lifecycle?.service_pack_key),
      inferText: [loaded.plan.name, loaded.lifecycle?.service_slug].map((part) => String(part ?? '')).join(' '),
      current: loaded.plan.growth_sections,
      industryPacks: industryPacks.map(toPackRef),
      servicePacks: servicePacks.map(toPackRef),
      tmmt,
      planObjective: String(loaded.plan.objectives ?? loaded.plan.north_star ?? ''),
      insight: loaded.insight
        ? {
            id: Number(loaded.insight.id),
            status: String(loaded.insight.status ?? ''),
            statement: String(loaded.insight.statement ?? ''),
            observation: String(loaded.insight.observation ?? ''),
            interpretation: String(loaded.insight.interpretation ?? ''),
            implication: String(loaded.insight.implication ?? ''),
          }
        : null,
      roleKpis: loaded.roleKpis.map((row) => {
        const form = asJson(row.form_data);
        return {
          id: Number(row.id),
          kpi_key: String(row.kpi_key ?? ''),
          kpi_label: String(row.kpi_label ?? ''),
          target_value: finiteOrNull(row.target_value),
          baseline: finiteOrNull(form.baseline),
          unit: String(row.target_unit ?? ''),
        };
      }),
      campaignNames: loaded.campaignNames,
    });
    if (write) {
      await this.repo.saveGrowth(input.planId, draft.growth_sections, input.actor);
    }
    return {
      ok: true,
      phase: 'P11',
      plan_id: input.planId,
      dry_run: !write,
      industry_pack_key: draft.industry_pack_key,
      service_pack_key: draft.service_pack_key,
      coverage: draft.coverage,
      blocks_touched: draft.blocks_touched,
      warnings: draft.warnings,
      links: draft.links,
      growth_sections: draft.growth_sections,
    };
  }

  async listGrowthExports(planId: number) {
    await this.requirePlan(planId);
    const exports = await this.repo.listGrowthExports(planId);
    return { ok: true, plan_id: planId, exports };
  }

  async readGrowthExport(planId: number, exportId: number) {
    const row = await this.repo.getGrowthExport(planId, exportId);
    if (!row) throw new NotFoundException({ error: 'plan_not_found', message: `export ${exportId}` });
    try {
      const buffer = await readFile(row.storagePath);
      return { filename: row.filename, buffer };
    } catch {
      throw new InternalServerErrorException({ error: 'export_engine_failed', message: 'Không đọc được file DOCX' });
    }
  }

  async exportGrowthDocx(input: {
    planId: number;
    lifecycleId?: number | null;
    insightId?: number | null;
    dryRun: boolean;
    persist: boolean;
    includeEmptyTables: boolean;
    humanApproved: boolean;
    actor: string;
  }) {
    const write = input.persist && !input.dryRun;
    if (write && !input.humanApproved) {
      throw new ForbiddenException({
        error: 'human_approval_required',
        message: 'marketing_plan.export_growth_docx persist cần X-AI-Human-Approved: 1',
      });
    }
    try {
      return await this.buildGrowthExport(input, write);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `export_growth_docx failed plan=${input.planId} dry_run=${!write}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException({
        error: 'export_build_failed',
        message: error instanceof Error && error.message ? error.message : 'Không tạo được DOCX',
      });
    }
  }

  private async buildGrowthExport(
    input: {
      planId: number;
      lifecycleId?: number | null;
      insightId?: number | null;
      dryRun: boolean;
      persist: boolean;
      includeEmptyTables: boolean;
      humanApproved: boolean;
      actor: string;
    },
    write: boolean,
  ) {
    const loaded = await withPoolRetry(this.logger, 'export_growth_docx', () =>
      this.repo.loadGenerateSources(input.planId, input.lifecycleId ?? null, input.insightId ?? null),
    );
    if (!loaded) throw new NotFoundException({ error: 'plan_not_found', message: `plan ${input.planId}` });
    if (String(loaded.plan.status ?? '') === 'archived') {
      throw new ConflictException({ error: 'plan_archived', message: 'Plan đã lưu trữ' });
    }
    const framework = asJson(loaded.plan.strategy_framework_json);
    const prof = asJson(loaded.plan.target_market_prof_json);
    const meta = asJson(framework.ai_tmmt_field_meta);
    const tmmt: Record<string, { text: string; status: string }> = {};
    for (const key of ['market_context', 'segmentation_icp', 'personas_roles', 'pains_desired_outcomes']) {
      const row = asJson(meta[key]);
      tmmt[key] = { text: String(row.text ?? row.value ?? prof[key] ?? ''), status: String(row.status ?? '') };
    }
    const industryKey = blank(loaded.plan.industry_pack_key) ?? blank(asJson(loaded.plan.growth_sections).industry_pack_key);
    const pack = industryKey ? await this.repo.getPack('industry', industryKey).catch(() => null) : null;
    const kpiRow = loaded.roleKpis.find((row) => finiteOrNull(row.target_value) != null || finiteOrNull(asJson(row.form_data).baseline) != null);
    const model = buildGrowthExportModel({
      planId: input.planId,
      brandName: blank(loaded.plan.name),
      serviceType: blank(loaded.lifecycle?.service_slug),
      periodLabel: blank(loaded.plan.period_label) ?? (loaded.plan.fiscal_year ? String(loaded.plan.fiscal_year) : null),
      planStatus: blank(loaded.plan.status),
      ownerName: null,
      geo: blank(prof.geo ?? prof.market_geo),
      industryPackKey: industryKey,
      industryPackName: pack?.name_vi ?? null,
      servicePackKey: blank(loaded.plan.service_pack_key),
      packJourney: pack?.journey_focus ?? null,
      packPriorities: pack?.marketing_priorities ?? null,
      growthSections: loaded.plan.growth_sections,
      includeEmptyTables: input.includeEmptyTables,
      tmmt,
      insight: loaded.insight
        ? {
            id: Number(loaded.insight.id),
            status: String(loaded.insight.status ?? ''),
            statement: String(loaded.insight.statement ?? ''),
            observation: String(loaded.insight.observation ?? ''),
            interpretation: String(loaded.insight.interpretation ?? ''),
          }
        : null,
      roleKpi: kpiRow
        ? {
            label: String(kpiRow.kpi_label ?? ''),
            target: finiteOrNull(kpiRow.target_value),
            baseline: finiteOrNull(asJson(kpiRow.form_data).baseline),
            unit: String(kpiRow.target_unit ?? ''),
          }
        : null,
      campaignNames: loaded.campaignNames,
      measurementExists: Boolean(kpiRow),
    });
    let versionLabel = 'Xem trước';
    if (write) {
      const existing = await this.repo.listGrowthExports(input.planId);
      const max = existing.reduce((highest, row) => Math.max(highest, row.version), 0);
      versionLabel = `v${max + 1}`;
    }
    const issuedOn = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    let built: Awaited<ReturnType<typeof buildGrowthDocx>>;
    try {
      built = await buildGrowthDocx({ ...model.template_fill, versionLabel, issuedOn });
    } catch (error) {
      this.logger.error(
        `export_growth_docx engine failed plan=${input.planId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException({ error: 'export_engine_failed', message: 'Không tạo được DOCX' });
    }
    const buffer = built.buffer;
    const fidelity = {
      template: built.template,
      structure_ok: built.structure_ok,
      table_count: built.table_count,
      missing_for_ops: model.missing_for_ops,
      deploy_ready: model.deploy_ready,
    };
    const publicSections = model.sections.map(({ id, title, fill_pct, missing }) => ({ id, title, fill_pct, missing }));
    if (!write) {
      return {
        ok: true,
        phase: 'P11',
        plan_id: input.planId,
        dry_run: true,
        export_id: null,
        filename: null,
        download_url: null,
        industry_pack_key: model.industry_pack_key,
        service_pack_key: model.service_pack_key,
        template_version: model.template_version,
        coverage: model.coverage,
        sections: publicSections,
        checklist: model.checklist,
        warnings: model.warnings,
        ...fidelity,
      };
    }
    const dir = process.env.PTT_GROWTH_EXPORT_DIR || path.join(process.cwd(), 'var', 'growth-exports');
    await mkdir(dir, { recursive: true });
    const placeholder = path.join(dir, `.pending-${input.planId}-${Date.now()}.docx`);
    await writeFile(placeholder, buffer);
    let saved: { id: number; version: number; filename: string };
    try {
      saved = await this.repo.insertGrowthExport({
        planId: input.planId,
        filename: 'pending.docx',
        storagePath: placeholder,
        coverage: model.coverage,
        actor: input.actor,
      });
    } catch (error) {
      this.logger.error(
        `export_growth_docx persist failed plan=${input.planId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException({ error: 'export_engine_failed', message: 'Không lưu được phiên bản DOCX' });
    }
    const filename = `Ke-hoach-tang-truong-plan-${input.planId}-v${saved.version}.docx`;
    const storagePath = path.join(dir, filename);
    await writeFile(storagePath, buffer);
    await unlink(placeholder).catch(() => undefined);
    await this.repo.renameGrowthExport(saved.id, filename, storagePath);
    return {
      ok: true,
      phase: 'P11',
      plan_id: input.planId,
      dry_run: false,
      export_id: saved.id,
      filename,
      download_url: `/api/crm/marketing-plans/${input.planId}/growth-exports/${saved.id}/download`,
      coverage: model.coverage,
      sections: publicSections,
      checklist: model.checklist,
      warnings: model.warnings,
      ...fidelity,
    };
  }

  private async requirePlan(planId: number) {
    const plan = await this.repo.getPlan(planId);
    if (!plan) throw new NotFoundException({ error: 'plan_not_found', message: `plan ${planId}` });
    return plan;
  }

  private async requirePack(kind: PackKind, key: string) {
    const row = await this.repo.getPack(kind, key);
    if (!row) throw new NotFoundException({ error: 'pack_not_found', message: key });
    return row;
  }
}
