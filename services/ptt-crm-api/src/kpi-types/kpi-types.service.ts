import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KpiTypeAuditRepository } from './kpi-type-audit.repository';
import { KpiTypeConnectorRegistry } from './connectors/kpi-type-connector.registry';
import { parseTestPeriod } from './connectors/kpi-type-connector.port';
import { parseKpiTypeFormula } from './formula/kpi-type-formula.parser';
import { KpiTypesRepository } from './kpi-types.repository';
import {
  KPI_TYPE_ERROR_CODES,
  type ChangeKpiTypeStatusBody,
  type CreateKpiTypeBody,
  type DuplicateKpiTypeBody,
  type KpiTypeAuditQuery,
  type KpiTypeDetail,
  type KpiTypeListQuery,
  type KpiTypeStatus,
  type KpiTypeValidationStatus,
  type PaginatedMeta,
  type PatchKpiTypeBody,
  type ValidateKpiTypeFormulaBody,
} from './kpi-types.types';
import {
  defaultDecimalPlaces,
  effectiveScopeDepartmentIds,
  effectiveScopePositionIds,
  isValidStatusTransition,
  isVersionedFieldChange,
  validateCreateKpiTypeBody,
  validateKpiTypeStatus,
  validateKpiTypeTargets,
  validatePatchKpiTypeBody,
} from './kpi-types.validation';

export type KpiTypeActor = {
  staffId: number;
  canConfigure: boolean;
};

function auditSnapshot(row: {
  code: string;
  name: string;
  status: string;
  kpi_group_id: string;
  calculation_mode: string;
  formula_expression?: string | null;
}): Record<string, unknown> {
  return {
    code: row.code,
    name: row.name,
    status: row.status,
    kpi_group_id: row.kpi_group_id,
    calculation_mode: row.calculation_mode,
    formula_expression: row.formula_expression ?? null,
  };
}

@Injectable()
export class KpiTypesService {
  constructor(
    private readonly repo: KpiTypesRepository,
    private readonly audit: KpiTypeAuditRepository,
    private readonly connectors: KpiTypeConnectorRegistry,
  ) {}

  private meta(page: number, pageSize: number, total: number): PaginatedMeta {
    return {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  private parsePageSize(raw?: number): number {
    return [20, 50, 100].includes(Number(raw)) ? Number(raw) : 20;
  }

  async list(query: KpiTypeListQuery) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = this.parsePageSize(query.page_size);
    const { rows, total } = await this.repo.listTypes({ ...query, page, page_size: pageSize });
    return { data: rows, meta: this.meta(page, pageSize, total) };
  }

  async summary() {
    return this.repo.getSummary();
  }

  async listUnits() {
    return this.repo.listUnits();
  }

  async listDataSources() {
    const sources = await this.repo.listDataSources();
    const out = [];
    for (const source of sources) {
      const health = await this.connectors.checkHealth(source.adapter_key);
      await this.repo.updateDataSourceHealth(source.id, health);
      out.push({ ...source, health });
    }
    return out;
  }

  async getById(id: string): Promise<KpiTypeDetail> {
    const row = await this.repo.getTypeById(id);
    if (!row) throw new NotFoundException({ error: KPI_TYPE_ERROR_CODES.NOT_FOUND });
    return this.repo.toDetail(row);
  }

  private async assertActiveGroup(groupId: string) {
    const group = await this.repo.getActiveGroup(groupId);
    if (!group) throw new BadRequestException({ error: KPI_TYPE_ERROR_CODES.GROUP_REQUIRED });
    if (group.status !== 'ACTIVE') {
      throw new BadRequestException({ error: KPI_TYPE_ERROR_CODES.GROUP_INACTIVE });
    }
    return group;
  }

  private async assertCanActivate(row: {
    calculation_mode: string;
    primary_data_source_id: string | null;
    formula_expression: string | null;
    validation_status: KpiTypeValidationStatus;
  }) {
    if (row.calculation_mode === 'MANUAL') return;
    if (!row.primary_data_source_id) {
      throw new BadRequestException({ error: KPI_TYPE_ERROR_CODES.AUTO_SOURCE_REQUIRED });
    }
    if (!row.formula_expression) {
      throw new BadRequestException({ error: KPI_TYPE_ERROR_CODES.FORMULA_REQUIRED });
    }
    if (row.validation_status !== 'VALID') {
      throw new BadRequestException({ error: KPI_TYPE_ERROR_CODES.ACTIVATE_INVALID });
    }
    const source = await this.repo.getDataSource(row.primary_data_source_id);
    if (!source) throw new BadRequestException({ error: KPI_TYPE_ERROR_CODES.AUTO_SOURCE_REQUIRED });
    const health = await this.connectors.checkHealth(source.adapter_key);
    if (health === 'UNAVAILABLE' || health === 'CONNECTION_ERROR') {
      throw new BadRequestException({ error: KPI_TYPE_ERROR_CODES.SOURCE_UNAVAILABLE });
    }
  }

  async create(actor: KpiTypeActor, body: CreateKpiTypeBody) {
    const err = validateCreateKpiTypeBody(body);
    if (err) throw new BadRequestException({ error: err });

    await this.assertActiveGroup(body.kpi_group_id);

    if (await this.repo.codeExists(body.code)) {
      throw new ConflictException({ error: KPI_TYPE_ERROR_CODES.CODE_DUPLICATE });
    }
    if (await this.repo.nameExists(body.name)) {
      throw new ConflictException({ error: KPI_TYPE_ERROR_CODES.NAME_DUPLICATE });
    }

    let displayOrder = body.display_order;
    if (displayOrder == null) {
      displayOrder = await this.repo.nextDisplayOrder();
    }

    const status = (body.status ?? 'DRAFT') as KpiTypeStatus;
    const statusErr = validateKpiTypeStatus(status);
    if (statusErr) throw new BadRequestException({ error: statusErr });

    const departmentIds = effectiveScopeDepartmentIds(body.scope_type, body.department_ids);
    const positionIds = effectiveScopePositionIds(body.scope_type, body.position_ids);

    const row = await this.repo.insertType(actor.staffId, {
      ...body,
      decimal_places: body.decimal_places ?? defaultDecimalPlaces(body.value_type),
      display_order: displayOrder,
      status: 'DRAFT',
      department_ids: departmentIds,
      position_ids: positionIds,
    });

    await this.audit.insert({
      entity_id: row.id,
      action: 'CREATE',
      after_json: auditSnapshot(row),
      performed_by_staff_id: actor.staffId,
    });

    if (status === 'ACTIVE') {
      return this.changeStatus(actor, row.id, { status: 'ACTIVE' });
    }

    return this.repo.toDetail(row);
  }

  async update(actor: KpiTypeActor, id: string, body: PatchKpiTypeBody, rowVersion: number) {
    const err = validatePatchKpiTypeBody(body);
    if (err) throw new BadRequestException({ error: err });

    const existing = await this.repo.getTypeById(id);
    if (!existing) throw new NotFoundException({ error: KPI_TYPE_ERROR_CODES.NOT_FOUND });

    if (body.kpi_group_id && body.kpi_group_id !== existing.kpi_group_id) {
      await this.assertActiveGroup(body.kpi_group_id);
    }

    if (body.code != null && body.code.trim().toUpperCase() !== existing.code) {
      if (await this.repo.codeExists(body.code, id)) {
        throw new ConflictException({ error: KPI_TYPE_ERROR_CODES.CODE_DUPLICATE });
      }
    }
    if (body.name != null && body.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      if (await this.repo.nameExists(body.name, id)) {
        throw new ConflictException({ error: KPI_TYPE_ERROR_CODES.NAME_DUPLICATE });
      }
    }

    const mergedTargets = {
      direction: body.direction ?? existing.direction,
      target_mode: body.target_mode ?? existing.target_mode,
      minimum_target: body.minimum_target !== undefined ? body.minimum_target : existing.minimum_target,
      default_target: body.default_target ?? existing.default_target,
      stretch_target: body.stretch_target !== undefined ? body.stretch_target : existing.stretch_target,
      lower_limit: body.lower_limit !== undefined ? body.lower_limit : existing.lower_limit,
      upper_limit: body.upper_limit !== undefined ? body.upper_limit : existing.upper_limit,
    };
    const targetErr = validateKpiTypeTargets(mergedTargets);
    if (targetErr) throw new BadRequestException({ error: targetErr });

    const scopeType = body.scope_type ?? existing.scope_type;
    const departmentIds =
      body.department_ids != null || body.scope_type != null
        ? effectiveScopeDepartmentIds(scopeType, body.department_ids ?? existing.department_ids)
        : undefined;
    const positionIds =
      body.position_ids != null || body.scope_type != null
        ? effectiveScopePositionIds(scopeType, body.position_ids ?? existing.position_ids)
        : undefined;

    const bumpVersion = existing.usage_count > 0 && isVersionedFieldChange(body);

    let updated: Awaited<ReturnType<KpiTypesRepository['patchType']>>;
    try {
      updated = await this.repo.patchType(actor.staffId, id, rowVersion, {
        ...body,
        department_ids: departmentIds,
        position_ids: positionIds,
        bump_version: bumpVersion,
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'VERSION_CONFLICT') {
        throw new ConflictException({ error: KPI_TYPE_ERROR_CODES.VERSION_CONFLICT });
      }
      throw e;
    }

    if (!updated) throw new NotFoundException({ error: KPI_TYPE_ERROR_CODES.NOT_FOUND });

    await this.audit.insert({
      entity_id: id,
      action: bumpVersion ? 'VERSION' : 'UPDATE',
      before_json: auditSnapshot(existing),
      after_json: auditSnapshot(updated),
      performed_by_staff_id: actor.staffId,
    });

    return this.repo.toDetail(updated);
  }

  async changeStatus(actor: KpiTypeActor, id: string, body: ChangeKpiTypeStatusBody) {
    const statusErr = validateKpiTypeStatus(body.status);
    if (statusErr) throw new BadRequestException({ error: statusErr });

    const existing = await this.repo.getTypeById(id);
    if (!existing) throw new NotFoundException({ error: KPI_TYPE_ERROR_CODES.NOT_FOUND });

    if (!isValidStatusTransition(existing.status, body.status)) {
      throw new BadRequestException({ error: KPI_TYPE_ERROR_CODES.STATUS_INVALID });
    }

    if (body.status === 'ACTIVE') {
      await this.assertActiveGroup(existing.kpi_group_id);
      await this.assertCanActivate(existing);
    }

    const updated = await this.repo.updateStatus(actor.staffId, id, body.status);
    if (!updated) throw new NotFoundException({ error: KPI_TYPE_ERROR_CODES.NOT_FOUND });

    const action =
      body.status === 'ACTIVE' && existing.status !== 'ACTIVE' ? 'ACTIVATE' : 'INACTIVATE';

    await this.audit.insert({
      entity_id: id,
      action,
      before_json: { status: existing.status, reason: body.reason ?? null },
      after_json: { status: updated.status },
      performed_by_staff_id: actor.staffId,
    });

    return this.repo.toDetail(updated);
  }

  async duplicate(actor: KpiTypeActor, id: string, body: DuplicateKpiTypeBody) {
    const existing = await this.repo.getTypeById(id);
    if (!existing) throw new NotFoundException({ error: KPI_TYPE_ERROR_CODES.NOT_FOUND });

    const createBody: CreateKpiTypeBody = {
      kpi_group_id: existing.kpi_group_id,
      code: body.code.trim().toUpperCase(),
      name: (body.name ?? `${existing.name} - Bản sao`).trim(),
      short_name: existing.short_name,
      description: existing.description,
      direction: existing.direction,
      value_type: existing.value_type,
      unit_id: existing.unit_id,
      decimal_places: existing.decimal_places,
      target_mode: existing.target_mode,
      minimum_target: existing.minimum_target,
      default_target: existing.default_target,
      stretch_target: existing.stretch_target,
      lower_limit: existing.lower_limit,
      upper_limit: existing.upper_limit,
      calculation_mode: existing.calculation_mode,
      primary_data_source_id: existing.primary_data_source_id,
      data_entity: existing.data_entity,
      aggregation_type: existing.aggregation_type,
      formula_expression: existing.formula_expression,
      formula_display: existing.formula_display,
      sync_frequency: existing.sync_frequency,
      timezone: existing.timezone,
      divide_by_zero_fallback: existing.divide_by_zero_fallback,
      manual_evidence_required: existing.manual_evidence_required,
      scope_type: existing.scope_type,
      department_ids: existing.department_ids,
      position_ids: existing.position_ids,
      weight_min: existing.weight_min,
      weight_max: existing.weight_max,
      display_order: await this.repo.nextDisplayOrder(),
      status: 'DRAFT',
    };

    return this.create(actor, createBody);
  }

  async delete(actor: KpiTypeActor, id: string): Promise<void> {
    const existing = await this.repo.getTypeById(id);
    if (!existing) throw new NotFoundException({ error: KPI_TYPE_ERROR_CODES.NOT_FOUND });

    const usageCount = await this.repo.getUsageCount(id);
    if (usageCount > 0) {
      throw new ConflictException({
        error: KPI_TYPE_ERROR_CODES.DELETE_REFERENCED,
        usage_count: usageCount,
      });
    }

    const ok = await this.repo.softDeleteType(actor.staffId, id);
    if (!ok) throw new NotFoundException({ error: KPI_TYPE_ERROR_CODES.NOT_FOUND });

    await this.audit.insert({
      entity_id: id,
      action: 'DELETE',
      before_json: auditSnapshot(existing),
      performed_by_staff_id: actor.staffId,
    });
  }

  async validateFormula(actor: KpiTypeActor, id: string, body: ValidateKpiTypeFormulaBody) {
    const existing = await this.repo.getTypeById(id);
    if (!existing) throw new NotFoundException({ error: KPI_TYPE_ERROR_CODES.NOT_FOUND });

    const expression = (body.formula_expression ?? existing.formula_expression ?? '').trim();
    if (!expression) {
      throw new BadRequestException({ error: KPI_TYPE_ERROR_CODES.FORMULA_REQUIRED });
    }

    let ast;
    try {
      ast = parseKpiTypeFormula(expression);
    } catch {
      await this.repo.updateCurrentVersionValidation(id, existing.current_version, 'INVALID', {
        message: 'Công thức không hợp lệ.',
      });
      return {
        validation_status: 'INVALID' as const,
        message: 'Công thức không hợp lệ. Vui lòng kiểm tra cú pháp hoặc trường dữ liệu',
        preview: null,
      };
    }

    const period = parseTestPeriod(body.test_period);
    const preview = await Promise.race([
      this.connectors.preview(ast, period, existing.divide_by_zero_fallback),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 10_000);
      }),
    ]).catch(() => ({
      value: null,
      records_scanned: null,
      health: 'CONNECTION_ERROR' as const,
      error: 'TIMEOUT',
    }));

    if (preview.health === 'CONNECTION_ERROR' || preview.health === 'UNAVAILABLE') {
      await this.repo.updateCurrentVersionValidation(id, existing.current_version, 'CONNECTION_ERROR', {
        health: preview.health,
        error: preview.error ?? null,
      });
      await this.audit.insert({
        entity_id: id,
        action: 'VALIDATE',
        after_json: { validation_status: 'CONNECTION_ERROR' },
        performed_by_staff_id: actor.staffId,
      });
      return {
        validation_status: 'CONNECTION_ERROR' as const,
        message: 'Không thể kết nối nguồn dữ liệu. Không ghi giá trị 0 giả.',
        preview: null,
      };
    }

    const formatted =
      preview.value == null
        ? null
        : `${preview.value.toLocaleString('vi-VN')} ${existing.unit?.name ?? ''}`.trim();

    await this.repo.updateCurrentVersionValidation(id, existing.current_version, 'VALID', {
      value: preview.value,
      records_scanned: preview.records_scanned,
      health: preview.health,
    });
    await this.audit.insert({
      entity_id: id,
      action: 'VALIDATE',
      after_json: { validation_status: 'VALID', value: preview.value },
      performed_by_staff_id: actor.staffId,
    });

    return {
      validation_status: 'VALID' as const,
      message: preview.health === 'STALE' ? 'Công thức hợp lệ. Nguồn dữ liệu có thể chậm (STALE).' : 'Công thức hợp lệ.',
      preview: {
        value: preview.value,
        formatted_value: formatted,
        records_scanned: preview.records_scanned,
        calculated_at: new Date().toISOString(),
      },
    };
  }

  async listVersions(id: string) {
    const existing = await this.repo.getTypeById(id);
    if (!existing) throw new NotFoundException({ error: KPI_TYPE_ERROR_CODES.NOT_FOUND });
    return { data: await this.repo.listVersions(id) };
  }

  async listAudit(id: string, query: KpiTypeAuditQuery) {
    const existing = await this.repo.getTypeById(id);
    if (!existing) throw new NotFoundException({ error: KPI_TYPE_ERROR_CODES.NOT_FOUND });

    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = this.parsePageSize(query.page_size);
    const { rows, total } = await this.audit.listByEntity(id, { page, page_size: pageSize });
    return { data: rows, meta: this.meta(page, pageSize, total) };
  }
}
