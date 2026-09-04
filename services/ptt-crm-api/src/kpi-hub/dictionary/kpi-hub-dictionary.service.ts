import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  buildDictionaryEdges,
  getUpstreamDownstream,
  markNeedReviewOnUpstreamChange,
} from '../formula/kpi-hub-formula.dependencies';
import {
  astToBindings,
  checksumsMatch,
  estimatePreviewRowCount,
  formulaAstChecksum,
  parseKpiHubFormula,
  validateKpiHubFormula,
  type HubSourceBinding,
} from '../formula/kpi-hub-formula.parser';
import {
  KPI_HUB_ERROR_CODES,
  type CreateHubDictionaryBody,
  type DuplicateHubDictionaryBody,
  type HubDictionaryListQuery,
  type KpiHubActor,
  type PaginatedMeta,
  type PatchHubDictionaryBody,
  type PreviewHubDictionaryBody,
  type ValidateHubDictionaryBody,
} from '../kpi-hub.types';
import { KpiHubDictionaryRepository } from './kpi-hub-dictionary.repository';
import { KpiHubConnectorRegistry } from '../connectors/kpi-hub-connector.registry';

const CODE_RE = /^[A-Z]{2,5}_[A-Z0-9_]+$/;

@Injectable()
export class KpiHubDictionaryService {
  constructor(
    private readonly repo: KpiHubDictionaryRepository,
    private readonly connectors: KpiHubConnectorRegistry,
  ) {}

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
    const bindings = this.repo.getBindings(id);
    return {
      ...row,
      bindings,
      versions: this.repo.listVersions(id),
      lineage: [
        { step: 1, label: row.primary_source, type: 'SOURCE' },
        { step: 2, label: row.formula_display ?? row.business_formula ?? '—', type: 'TRANSFORM' },
      ],
    };
  }

  async getDependencies(id: string) {
    await this.repo.seedIfEmpty();
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });
    const rows = this.repo.allRows();
    const edges = buildDictionaryEdges(rows);
    const graph = getUpstreamDownstream(row.code, edges);
    const impacted = markNeedReviewOnUpstreamChange(row.code, rows, edges);
    return {
      dictionary_id: id,
      code: row.code,
      upstream: graph.upstream.map((code) => {
        const ref = rows.find((r) => r.code === code);
        return { code, name: ref?.name ?? code, status: ref?.status ?? 'UNKNOWN' };
      }),
      downstream: graph.downstream.map((code) => {
        const ref = rows.find((r) => r.code === code);
        return { code, name: ref?.name ?? code, status: ref?.status ?? 'UNKNOWN' };
      }),
      edges: graph.edges,
      would_mark_need_review: impacted,
    };
  }

  async preview(id: string, body: PreviewHubDictionaryBody) {
    await this.repo.seedIfEmpty();
    const row = await this.repo.getById(id);
    if (!row) throw new NotFoundException({ error: KPI_HUB_ERROR_CODES.NOT_FOUND });

    const expression =
      body.formula_display ??
      row.formula_display ??
      row.business_formula ??
      (row.numerator_code && row.denominator_code
        ? `RATIO(${row.numerator_code} / ${row.denominator_code})`
        : '');

    const validation = validateKpiHubFormula({
      code: row.code,
      expression,
      numerator_code: body.numerator_code ?? row.numerator_code,
      denominator_code: body.denominator_code ?? row.denominator_code,
      known_codes: this.repo.allCodes(),
    });

    if (!validation.valid || !validation.ast) {
      throw new BadRequestException({
        error: KPI_HUB_ERROR_CODES.FORMULA_INVALID,
        errors: validation.errors,
      });
    }

    const rowCount = estimatePreviewRowCount(validation.ast);
    const bindings = astToBindings(validation.ast);
    return {
      dictionary_id: id,
      code: row.code,
      row_count: rowCount,
      row_count_label: `${rowCount.toLocaleString('vi-VN')} dòng khớp (ước tính)`,
      ast_checksum: formulaAstChecksum(validation.ast),
      bindings,
      preview_ms: 42,
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

    if (body.formula_display && updated.formula_display) {
      try {
        const ast = parseKpiHubFormula(updated.formula_display);
        this.repo.setBindings(id, astToBindings(ast));
      } catch {
        // ignore invalid draft formulas during patch
      }
    }

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

    if (validation.valid && validation.ast) {
      const bindings = this.repo.getBindings(id);
      const derived = astToBindings(validation.ast);
      const effectiveBindings = (bindings.length ? bindings : derived) as HubSourceBinding[];
      if (effectiveBindings.length && !checksumsMatch(validation.ast, effectiveBindings)) {
        blockers.push(KPI_HUB_ERROR_CODES.FORMULA_CHECKSUM_MISMATCH);
      }
      if (!bindings.length && derived.length) {
        this.repo.setBindings(id, derived);
      }
    }

    if (blockers.length > 0) {
      throw new BadRequestException({ error: KPI_HUB_ERROR_CODES.PUBLISH_BLOCKED, blockers });
    }

    const wasActive = row.status === 'ACTIVE';
    const formulaChanged =
      wasActive &&
      Boolean(row.formula_display || row.numerator_code || row.denominator_code);

    const published = await this.repo.publish(id, rowVersion || row.row_version, {
      pendingApproval: formulaChanged,
      formulaChanged,
    });
    if (!published) throw new ConflictException({ error: KPI_HUB_ERROR_CODES.VERSION_CONFLICT });

    if (wasActive && formulaChanged) {
      const edges = buildDictionaryEdges(this.repo.allRows());
      const downstream = markNeedReviewOnUpstreamChange(row.code, this.repo.allRows(), edges);
      this.repo.markDownstreamNeedReview(downstream);
    }

    return {
      ...published,
      pending_approval: formulaChanged,
      version: published.current_version,
    };
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
    const bindings = this.repo.getBindings(id);
    const checksumOk =
      result.valid && result.ast
        ? checksumsMatch(result.ast, (bindings.length ? bindings : astToBindings(result.ast)) as HubSourceBinding[])
        : true;
    return {
      dictionary_id: id,
      code: row.code,
      ...result,
      checks: {
        formula: result.valid,
        source_bound: Boolean(row.primary_source),
        owners: Boolean(row.kpi_owner?.id && row.data_owner?.id),
        cycle_free: !result.errors?.includes(KPI_HUB_ERROR_CODES.FORMULA_CYCLE),
        checksum_match: checksumOk,
      },
    };
  }

  private validateCode(code: string) {
    if (!code?.trim()) throw new BadRequestException({ error: KPI_HUB_ERROR_CODES.CODE_REQUIRED });
    if (!CODE_RE.test(code)) throw new BadRequestException({ error: KPI_HUB_ERROR_CODES.CODE_INVALID });
  }
}
