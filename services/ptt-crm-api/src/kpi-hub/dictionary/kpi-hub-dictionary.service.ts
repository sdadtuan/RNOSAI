import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { validateKpiHubFormula } from '../formula/kpi-hub-formula.parser';
import {
  KPI_HUB_ERROR_CODES,
  type CreateHubDictionaryBody,
  type DuplicateHubDictionaryBody,
  type HubDictionaryListQuery,
  type KpiHubActor,
  type PaginatedMeta,
  type PatchHubDictionaryBody,
  type ValidateHubDictionaryBody,
} from '../kpi-hub.types';
import { KpiHubDictionaryRepository } from './kpi-hub-dictionary.repository';

const CODE_RE = /^[A-Z]{2,5}_[A-Z0-9_]+$/;

@Injectable()
export class KpiHubDictionaryService {
  constructor(private readonly repo: KpiHubDictionaryRepository) {}

  private meta(page: number, pageSize: number, total: number): PaginatedMeta {
    return {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async list(query: HubDictionaryListQuery) {
    await this.repo.seedIfEmpty();
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = [20, 50, 100].includes(Number(query.page_size)) ? Number(query.page_size) : 20;
    const { items, total } = await this.repo.list({ ...query, page, page_size: pageSize });
    const summary = await this.repo.summary();
    return { items, summary, meta: this.meta(page, pageSize, total) };
  }

  async summary() {
    await this.repo.seedIfEmpty();
    return this.repo.summary();
  }

  async getById(id: string) {
    await this.repo.seedIfEmpty();
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    return {
      ...row,
      bindings: [],
      lineage: [
        { step: 1, label: row.primary_source, type: 'SOURCE' },
        { step: 2, label: row.formula_display ?? row.business_formula ?? '—', type: 'TRANSFORM' },
      ],
    };
  }

  async create(actor: KpiHubActor, body: CreateHubDictionaryBody) {
    this.validateCode(body.code);
    if (!body.name?.trim()) {
      throw new BadRequestException({ error: KPI_HUB_ERROR_CODES.NAME_REQUIRED });
    }
    const dup = await this.repo.getByCode(body.code);
    if (dup) throw new BadRequestException({ error: KPI_HUB_ERROR_CODES.CODE_DUPLICATE });
    const row = await this.repo.create(body, actor.staffId);
    return row;
  }

  async update(actor: KpiHubActor, id: string, body: PatchHubDictionaryBody, rowVersion: number) {
    await this.repo.seedIfEmpty();
    const existing = await this.repo.getById(id);
    if (!existing) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    if (existing.status === 'ACTIVE' && (body.calc_kind || body.numerator_code || body.denominator_code)) {
      body = { ...body };
    }
    const updated = await this.repo.patch(id, body, rowVersion || existing.row_version);
    if (!updated) throw new ConflictException({ error: KPI_HUB_ERROR_CODES.VERSION_CONFLICT });
    return updated;
  }

  async publish(actor: KpiHubActor, id: string, rowVersion: number) {
    await this.repo.seedIfEmpty();
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });

    const validation = validateKpiHubFormula({
      code: row.code,
      expression: row.formula_display ?? row.business_formula ?? '',
      numerator_code: row.numerator_code,
      denominator_code: row.denominator_code,
      known_codes: this.repo.allCodes(),
    });

    const blockers: string[] = [];
    if (row.calc_kind === 'RATIO' && (!row.numerator_code || !row.denominator_code) && !validation.valid) {
      blockers.push(KPI_HUB_ERROR_CODES.FORMULA_INVALID);
    }
    if (!row.primary_source) blockers.push('MISSING_SOURCE');
    if (!row.kpi_owner?.id) blockers.push('MISSING_KPI_OWNER');
    if (!row.data_owner?.id) blockers.push('MISSING_DATA_OWNER');
    if (blockers.length > 0) {
      throw new BadRequestException({ error: KPI_HUB_ERROR_CODES.PUBLISH_BLOCKED, blockers });
    }

    const published = await this.repo.publish(id, rowVersion || row.row_version);
    if (!published) throw new ConflictException({ error: KPI_HUB_ERROR_CODES.VERSION_CONFLICT });
    return published;
  }

  async duplicate(actor: KpiHubActor, id: string, body: DuplicateHubDictionaryBody) {
    await this.repo.seedIfEmpty();
    const source = await this.repo.getById(id);
    if (!source) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    const code = body.code ?? `${source.code}_COPY`;
    const name = body.name ?? `${source.name} (bản sao)`;
    this.validateCode(code);
    const dup = await this.repo.getByCode(code);
    if (dup) throw new BadRequestException({ error: KPI_HUB_ERROR_CODES.CODE_DUPLICATE });
    return this.repo.duplicate(id, code, name, actor.staffId);
  }

  async validate(id: string, body: ValidateHubDictionaryBody) {
    await this.repo.seedIfEmpty();
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    const result = validateKpiHubFormula({
      code: row.code,
      expression: body.formula_display ?? row.formula_display ?? row.business_formula ?? '',
      numerator_code: body.numerator_code ?? row.numerator_code,
      denominator_code: body.denominator_code ?? row.denominator_code,
      known_codes: this.repo.allCodes(),
    });
    return {
      dictionary_id: id,
      code: row.code,
      ...result,
      checks: {
        formula: result.valid,
        source_bound: Boolean(row.primary_source),
        owners: Boolean(row.kpi_owner?.id && row.data_owner?.id),
        cycle_free: !result.errors?.includes(KPI_HUB_ERROR_CODES.FORMULA_CYCLE),
      },
    };
  }

  private validateCode(code: string) {
    if (!code?.trim()) throw new BadRequestException({ error: KPI_HUB_ERROR_CODES.CODE_REQUIRED });
    if (!CODE_RE.test(code)) throw new BadRequestException({ error: KPI_HUB_ERROR_CODES.CODE_INVALID });
  }
}
