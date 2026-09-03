import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KpiGroupAuditRepository } from './kpi-group-audit.repository';
import { KpiGroupsRepository } from './kpi-groups.repository';
import {
  KPI_GROUP_ERROR_CODES,
  type ChangeKpiGroupStatusBody,
  type CreateKpiGroupBody,
  type DuplicateKpiGroupBody,
  type KpiGroupAuditQuery,
  type KpiGroupDetail,
  type KpiGroupListQuery,
  type KpiGroupStatus,
  type ImportKpiGroupsBody,
  type ImportKpiGroupsResult,
  type ImportKpiGroupRowResult,
  type PaginatedMeta,
  type PatchKpiGroupBody,
  type ReorderKpiGroupsBody,
} from './kpi-groups.types';
import {
  effectiveScopeDepartmentIds,
  effectiveScopePositionIds,
  isValidStatusTransition,
  validateCreateKpiGroupBody,
  validateKpiGroupDataDomains,
  validateKpiGroupDisplayOrder,
  validateKpiGroupStatus,
  validateKpiGroupUnitTypes,
  validatePatchKpiGroupBody,
} from './kpi-groups.validation';

export type KpiGroupActor = {
  staffId: number;
  canConfigure: boolean;
};

function auditSnapshot(row: {
  code: string;
  name: string;
  status: string;
  scope_type: string;
  display_order: number;
}): Record<string, unknown> {
  return {
    code: row.code,
    name: row.name,
    status: row.status,
    scope_type: row.scope_type,
    display_order: row.display_order,
  };
}

@Injectable()
export class KpiGroupsService {
  constructor(
    private readonly repo: KpiGroupsRepository,
    private readonly audit: KpiGroupAuditRepository,
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

  async list(query: KpiGroupListQuery) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = this.parsePageSize(query.page_size);
    const { rows, total } = await this.repo.listGroups({ ...query, page, page_size: pageSize });
    return { data: rows, meta: this.meta(page, pageSize, total) };
  }

  async summary() {
    return this.repo.getSummary();
  }

  async getById(id: string): Promise<KpiGroupDetail> {
    const row = await this.repo.getGroupById(id);
    if (!row) throw new NotFoundException({ error: KPI_GROUP_ERROR_CODES.NOT_FOUND });
    return this.repo.toDetail(row);
  }

  async create(actor: KpiGroupActor, body: CreateKpiGroupBody) {
    const err = validateCreateKpiGroupBody(body);
    if (err) throw new BadRequestException({ error: err });

    if (await this.repo.codeExists(body.code)) {
      throw new ConflictException({ error: KPI_GROUP_ERROR_CODES.CODE_DUPLICATE });
    }
    if (await this.repo.nameExists(body.name)) {
      throw new ConflictException({ error: KPI_GROUP_ERROR_CODES.NAME_DUPLICATE });
    }

    let displayOrder = body.display_order;
    if (displayOrder == null) {
      displayOrder = await this.repo.nextDisplayOrder();
    } else {
      const orderErr = validateKpiGroupDisplayOrder(displayOrder);
      if (orderErr) throw new BadRequestException({ error: orderErr });
    }

    const status = (body.status ?? 'DRAFT') as KpiGroupStatus;
    const statusErr = validateKpiGroupStatus(status);
    if (statusErr) throw new BadRequestException({ error: statusErr });

    const departmentIds = effectiveScopeDepartmentIds(body.scope_type, body.department_ids);
    const positionIds = effectiveScopePositionIds(body.scope_type, body.position_ids);

    const row = await this.repo.insertGroup(actor.staffId, {
      ...body,
      display_order: displayOrder,
      status,
      department_ids: departmentIds,
      position_ids: positionIds,
      suggested_unit_types: validateKpiGroupUnitTypes(body.suggested_unit_types),
      data_domains: validateKpiGroupDataDomains(body.data_domains),
      color: body.color ?? '#17B6A4',
    });

    await this.audit.insert({
      entity_id: row.id,
      action: 'CREATE',
      after_json: auditSnapshot(row),
      performed_by_staff_id: actor.staffId,
    });

    return this.repo.toDetail(row);
  }

  async update(actor: KpiGroupActor, id: string, body: PatchKpiGroupBody, rowVersion: number) {
    const err = validatePatchKpiGroupBody(body);
    if (err) throw new BadRequestException({ error: err });

    const existing = await this.repo.getGroupById(id);
    if (!existing) throw new NotFoundException({ error: KPI_GROUP_ERROR_CODES.NOT_FOUND });

    if (body.code != null && body.code.trim().toUpperCase() !== existing.code) {
      if (existing.usage_count > 0) {
        throw new ConflictException({ error: KPI_GROUP_ERROR_CODES.CODE_LOCKED });
      }
      if (existing.is_system_default && !actor.canConfigure) {
        throw new ConflictException({ error: KPI_GROUP_ERROR_CODES.SYSTEM_CODE_LOCKED });
      }
      if (await this.repo.codeExists(body.code, id)) {
        throw new ConflictException({ error: KPI_GROUP_ERROR_CODES.CODE_DUPLICATE });
      }
    }

    if (body.name != null && body.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      if (await this.repo.nameExists(body.name, id)) {
        throw new ConflictException({ error: KPI_GROUP_ERROR_CODES.NAME_DUPLICATE });
      }
    }

    const scopeType = body.scope_type ?? existing.scope_type;
    const departmentIds =
      body.department_ids != null || body.scope_type != null
        ? effectiveScopeDepartmentIds(scopeType, body.department_ids ?? existing.department_ids)
        : undefined;
    const positionIds =
      body.position_ids != null || body.scope_type != null
        ? effectiveScopePositionIds(scopeType, body.position_ids ?? existing.position_ids)
        : undefined;

    if (body.scope_type != null || body.department_ids != null || body.position_ids != null) {
      const scopeErr = validatePatchKpiGroupBody({
        ...body,
        scope_type: scopeType,
        department_ids: departmentIds,
        position_ids: positionIds,
      });
      if (scopeErr) throw new BadRequestException({ error: scopeErr });
    }

    let updated: Awaited<ReturnType<KpiGroupsRepository['patchGroup']>>;
    try {
      updated = await this.repo.patchGroup(actor.staffId, id, rowVersion, {
        ...body,
        department_ids: departmentIds,
        position_ids: positionIds,
        suggested_unit_types:
          body.suggested_unit_types != null
            ? validateKpiGroupUnitTypes(body.suggested_unit_types)
            : undefined,
        data_domains:
          body.data_domains != null
            ? validateKpiGroupDataDomains(body.data_domains)
            : undefined,
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'VERSION_CONFLICT') {
        throw new ConflictException({ error: KPI_GROUP_ERROR_CODES.VERSION_CONFLICT });
      }
      throw e;
    }

    if (!updated) throw new NotFoundException({ error: KPI_GROUP_ERROR_CODES.NOT_FOUND });

    await this.audit.insert({
      entity_id: id,
      action: 'UPDATE',
      before_json: auditSnapshot(existing),
      after_json: auditSnapshot(updated),
      performed_by_staff_id: actor.staffId,
    });

    return this.repo.toDetail(updated);
  }

  async changeStatus(actor: KpiGroupActor, id: string, body: ChangeKpiGroupStatusBody) {
    const statusErr = validateKpiGroupStatus(body.status);
    if (statusErr) throw new BadRequestException({ error: statusErr });

    const existing = await this.repo.getGroupById(id);
    if (!existing) throw new NotFoundException({ error: KPI_GROUP_ERROR_CODES.NOT_FOUND });

    if (!isValidStatusTransition(existing.status, body.status)) {
      throw new BadRequestException({ error: KPI_GROUP_ERROR_CODES.STATUS_INVALID });
    }

    const updated = await this.repo.updateStatus(actor.staffId, id, body.status);
    if (!updated) throw new NotFoundException({ error: KPI_GROUP_ERROR_CODES.NOT_FOUND });

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

  async duplicate(actor: KpiGroupActor, id: string, body: DuplicateKpiGroupBody) {
    const existing = await this.repo.getGroupById(id);
    if (!existing) throw new NotFoundException({ error: KPI_GROUP_ERROR_CODES.NOT_FOUND });

    const code = body.code.trim().toUpperCase();
    const name = (body.name ?? `${existing.name} - Bản sao`).trim();

    const createBody: CreateKpiGroupBody = {
      code,
      name,
      description: existing.description ?? undefined,
      scope_type: existing.scope_type,
      department_ids: existing.department_ids,
      position_ids: existing.position_ids,
      default_direction: existing.default_direction,
      suggested_unit_types: existing.suggested_unit_types,
      data_domains: existing.data_domains,
      color: existing.color,
      icon: existing.icon ?? undefined,
      display_order: await this.repo.nextDisplayOrder(),
      status: 'DRAFT',
    };

    return this.create(actor, createBody);
  }

  async delete(actor: KpiGroupActor, id: string): Promise<void> {
    const existing = await this.repo.getGroupById(id);
    if (!existing) throw new NotFoundException({ error: KPI_GROUP_ERROR_CODES.NOT_FOUND });

    const usageCount = await this.repo.getUsageCount(id);
    if (usageCount > 0) {
      throw new ConflictException({
        error: KPI_GROUP_ERROR_CODES.DELETE_REFERENCED,
        usage_count: usageCount,
      });
    }

    const ok = await this.repo.softDeleteGroup(actor.staffId, id);
    if (!ok) throw new NotFoundException({ error: KPI_GROUP_ERROR_CODES.NOT_FOUND });

    await this.audit.insert({
      entity_id: id,
      action: 'DELETE',
      before_json: auditSnapshot(existing),
      performed_by_staff_id: actor.staffId,
    });
  }

  async reorder(actor: KpiGroupActor, body: ReorderKpiGroupsBody) {
    const items = body.items ?? [];
    for (const item of items) {
      const orderErr = validateKpiGroupDisplayOrder(item.display_order);
      if (orderErr) throw new BadRequestException({ error: orderErr });
    }

    await this.repo.updateDisplayOrders(actor.staffId, items);

    await this.audit.insert({
      entity_id: items[0]?.id ?? 'bulk',
      action: 'REORDER',
      after_json: { items },
      performed_by_staff_id: actor.staffId,
    });

    return { ok: true };
  }

  async importRows(actor: KpiGroupActor, body: ImportKpiGroupsBody): Promise<ImportKpiGroupsResult> {
    const rows = body.rows ?? [];
    const results: ImportKpiGroupRowResult[] = [];
    let created = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      try {
        const detail = await this.create(actor, row);
        created += 1;
        results.push({ row_index: i + 1, code: row.code, ok: true, id: detail.id });
      } catch (err) {
        let error = 'IMPORT_FAILED';
        if (err instanceof BadRequestException || err instanceof ConflictException) {
          const res = err.getResponse();
          if (typeof res === 'object' && res && 'error' in res) {
            error = String((res as { error?: string }).error ?? error);
          }
        }
        results.push({ row_index: i + 1, code: row.code, ok: false, error });
      }
    }

    return {
      created,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  async listAudit(id: string, query: KpiGroupAuditQuery) {
    const existing = await this.repo.getGroupById(id);
    if (!existing) throw new NotFoundException({ error: KPI_GROUP_ERROR_CODES.NOT_FOUND });

    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = this.parsePageSize(query.page_size);
    const { rows, total } = await this.audit.listByEntity(id, { page, page_size: pageSize });
    return { data: rows, meta: this.meta(page, pageSize, total) };
  }
}
