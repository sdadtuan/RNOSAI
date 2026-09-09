import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { isInternalOnly } from './service-kpi-classification';
import { canPublishClientReport } from './service-kpi-ledgers';
import { validateReadiness } from './service-kpi-readiness';
import { percentile50, percentile80 } from './service-kpi-benchmark';
import { ServiceKpiRepository } from './service-kpi.repository';
import type { CreateInstanceBody, PatchInstanceBody, ServiceKpiInstanceRow } from './service-kpi.types';

@Injectable()
export class ServiceKpiInstancesService {
  constructor(private readonly repo: ServiceKpiRepository) {}

  async syncFromCatalog(input: {
    sourceType: 'quote_line_item';
    sourceId: string;
    dvCode: string;
  }): Promise<{ created: number; template_version_id: string | null }> {
    const dv = String(input.dvCode ?? '').trim().toUpperCase();
    if (!dv) return { created: 0, template_version_id: null };
    const version = await this.repo.findActiveTemplateVersion(dv);
    if (!version) return { created: 0, template_version_id: null };

    const existing = await this.repo.listInstances({
      source_type: input.sourceType,
      source_id: input.sourceId,
    });
    const existingDict = new Set(existing.map((i) => i.dictionary_id));
    let created = 0;
    for (const rule of version.rules) {
      if (existingDict.has(rule.dictionary_id)) continue;
      await this.repo.insertInstance({
        source_type: input.sourceType,
        source_id: input.sourceId,
        dv_code: dv,
        dictionary_id: rule.dictionary_id,
        template_version_id: version.id,
        classification: rule.classification,
        status: 'DRAFT',
        client_visible: rule.client_visible,
        owner_name: rule.owner_role || null,
        target_min: rule.target_min,
        target_max: rule.target_max,
        scenario: rule.scenario,
        assumption_text: rule.assumption_template,
        assumption_state: 'pending',
        disclaimer_text: rule.disclaimer_template,
      });
      created += 1;
    }
    return { created, template_version_id: version.id };
  }

  async create(body: CreateInstanceBody): Promise<ServiceKpiInstanceRow> {
    const sourceType = String(body.source_type ?? '').trim();
    const sourceId = String(body.source_id ?? '').trim();
    const dictionaryId = String(body.dictionary_id ?? '').trim();
    if (!sourceType || !sourceId || !dictionaryId) {
      throw new BadRequestException({ error: 'INSTANCE_CREATE_INVALID' });
    }
    const dv = String(body.dv_code ?? '').trim().toUpperCase() || null;
    const classification = body.classification ?? 'OPTIMIZATION_TARGET';
    const row = await this.repo.insertInstance({
      source_type: sourceType,
      source_id: sourceId,
      dv_code: dv,
      dictionary_id: dictionaryId,
      template_version_id: body.template_version_id ?? null,
      classification,
      status: 'DRAFT',
      client_visible: body.client_visible ?? classification !== 'INTERNAL_OPERATIONAL',
      owner_name: body.owner_name?.trim() || null,
      target_min: body.target_min ?? null,
      target_max: body.target_max ?? null,
      scenario: body.scenario?.trim() || 'base',
      assumption_text: body.assumption_text?.trim() || '',
      assumption_state: 'pending',
      disclaimer_text: body.disclaimer_text?.trim() || '',
    });
    return this.enrichInstance(row);
  }

  async list(query: {
    source_type?: string;
    source_id?: string;
    status?: string;
    dv_code?: string;
  }): Promise<{ items: ServiceKpiInstanceRow[]; total: number }> {
    const items = await this.repo.listInstances(query);
    const enriched = await Promise.all(items.map((row) => this.enrichInstance(row)));
    return { items: enriched, total: enriched.length };
  }

  async get(id: string): Promise<ServiceKpiInstanceRow> {
    const row = await this.repo.getInstance(id);
    if (!row) throw new NotFoundException({ error: 'INSTANCE_NOT_FOUND' });
    return this.enrichInstance(row);
  }

  async patch(id: string, body: PatchInstanceBody, rowVersion: number) {
    if (body.assumption_state === 'not_met') {
      body.status = 'AT_RISK';
    }
    const updated = await this.repo.patchInstance(id, body, rowVersion);
    if (updated === null) throw new NotFoundException({ error: 'INSTANCE_NOT_FOUND' });
    if (updated === 'conflict') {
      throw new ConflictException({ error: 'SERVICE_KPI_VERSION_CONFLICT' });
    }
    return this.enrichInstance(updated);
  }

  async validateReadiness(id: string) {
    const row = await this.get(id);
    const plan = await this.repo.getMeasurementPlan(id);
    const result = validateReadiness({
      classification: row.classification,
      clientVisible: row.client_visible,
      hasDefinition: true,
      hasQuantityOrTarget: row.target_min != null || row.target_max != null,
      hasDisclaimer: Boolean(row.disclaimer_text?.trim()),
      hasAssumption: Boolean(row.assumption_text?.trim()),
      hasScenario: Boolean(row.scenario && row.scenario !== 'base') || row.classification !== 'PROJECTED_RESULT',
      hasDataSource: Boolean(plan?.data_source?.trim()),
      hasOwner: Boolean(row.owner_name?.trim()),
    });
    if (!plan?.field_mapping?.trim() && result.level === 'pass') {
      return { ...result, level: 'warning' as const, errors: [{ field: 'field_mapping', message: 'Mapping trống' }] };
    }
    return result;
  }

  async snapshotQuoted(quoteVersionId: string): Promise<{ snapshots: number }> {
    const instances = await this.repo.listInstances({ source_type: 'proposal_version', source_id: quoteVersionId });
    const lineInstances = await this.repo.listInstances({});
    const all = [
      ...instances,
      ...lineInstances.filter((i) => i.source_type === 'quote_line_item'),
    ];
    let snapshots = 0;
    for (const inst of all) {
      await this.repo.insertSnapshot({
        instance_id: inst.id,
        quote_version_id: quoteVersionId,
        ledger: 'quoted',
        payload_json: {
          dictionary_id: inst.dictionary_id,
          classification: inst.classification,
          target_min: inst.target_min,
          target_max: inst.target_max,
          scenario: inst.scenario,
          assumption_text: inst.assumption_text,
          disclaimer_text: inst.disclaimer_text,
          client_visible: inst.client_visible,
        },
      });
      snapshots += 1;
    }
    return { snapshots };
  }

  async cloneToProject(input: { lineId: string; projectId: string }): Promise<{ cloned: number }> {
    const sources = await this.repo.listInstances({
      source_type: 'quote_line_item',
      source_id: input.lineId,
    });
    let cloned = 0;
    for (const src of sources) {
      const row = await this.repo.insertInstance({
        source_type: 'project',
        source_id: input.projectId,
        dv_code: src.dv_code,
        dictionary_id: src.dictionary_id,
        template_version_id: src.template_version_id,
        classification: src.classification,
        status: 'TRACKING',
        client_visible: src.client_visible,
        owner_name: src.owner_name,
        target_min: src.target_min,
        target_max: src.target_max,
        scenario: src.scenario,
        assumption_text: src.assumption_text,
        assumption_state: src.assumption_state,
        disclaimer_text: src.disclaimer_text,
      });
      const plan = await this.repo.getMeasurementPlan(src.id);
      await this.repo.upsertMeasurementPlan(row.id, {
        owner_name: plan?.owner_name ?? src.owner_name ?? 'AM',
        cadence: plan?.cadence ?? 'monthly',
        data_source: plan?.data_source ?? '',
        field_mapping: plan?.field_mapping ?? '',
        freshness_sla_hours: plan?.freshness_sla_hours ?? 24,
        qa_status: 'draft',
      });
      cloned += 1;
    }
    return { cloned };
  }

  async recordBenchmarkOnProjectClose(input: {
    projectId: string;
    industry?: string;
    channel?: string;
    valuesByDictionary: Record<string, number[]>;
  }): Promise<number> {
    const instances = await this.repo.listInstances({ source_type: 'project', source_id: input.projectId });
    let upserts = 0;
    for (const inst of instances) {
      const values = input.valuesByDictionary[inst.dictionary_id];
      if (!values?.length || !inst.dv_code) continue;
      const p50 = percentile50(values);
      if (p50 == null) continue;
      await this.repo.upsertBenchmark({
        dv_code: inst.dv_code,
        dictionary_id: inst.dictionary_id,
        industry: input.industry,
        channel: input.channel,
        budget_band: '',
        p50,
        p80: percentile80(values),
        sample_n: values.length,
      });
      upserts += 1;
    }
    return upserts;
  }

  async getPublicKpisForProposal(proposalId: number, versionId: string): Promise<Array<Record<string, unknown>>> {
    const lineInstances = await this.repo.listInstances({});
    const relevant = lineInstances.filter(
      (i) => i.source_type === 'quote_line_item' || (i.source_type === 'proposal_version' && i.source_id === versionId),
    );
    const snapshots = await this.repo.listSnapshots({ quote_version_id: versionId });
    const reported = snapshots.filter((s) => s.ledger === 'reported');
    const quoted = snapshots.filter((s) => s.ledger === 'quoted');
    const out: Array<Record<string, unknown>> = [];

    for (const inst of relevant) {
      if (isInternalOnly(inst.classification) || !inst.client_visible) continue;
      const rep = reported.find((s) => s.instance_id === inst.id);
      const quo = quoted.find((s) => s.instance_id === inst.id);
      const payload = rep?.payload_json ?? quo?.payload_json;
      if (!payload) continue;
      const quality = String((payload as { quality_status?: string }).quality_status ?? 'pending_validation');
      if (rep && !canPublishClientReport(quality as 'valid', true)) continue;
      if (!rep && quo) {
        out.push({
          dictionary_id: inst.dictionary_id,
          classification: inst.classification,
          target_min: inst.target_min,
          target_max: inst.target_max,
          scenario: inst.scenario,
          disclaimer_text: inst.disclaimer_text,
          ledger: 'quoted',
        });
        continue;
      }
      if (rep) {
        out.push({ ...payload, ledger: 'reported' });
      }
    }
    return out;
  }

  private async enrichInstance(row: ServiceKpiInstanceRow): Promise<ServiceKpiInstanceRow> {
    const actuals = await this.repo.listActuals(row.id);
    const latest = actuals[0];
    const readiness = validateReadiness({
      classification: row.classification,
      clientVisible: row.client_visible,
      hasDefinition: true,
      hasQuantityOrTarget: row.target_min != null || row.target_max != null,
      hasDisclaimer: Boolean(row.disclaimer_text?.trim()),
      hasAssumption: Boolean(row.assumption_text?.trim()),
      hasScenario: Boolean(row.scenario && row.scenario !== 'base') || row.classification !== 'PROJECTED_RESULT',
      hasDataSource: true,
      hasOwner: Boolean(row.owner_name?.trim()),
    });
    let variance_pct: number | null = null;
    if (latest?.value != null && row.target_max != null && row.target_max > 0) {
      variance_pct = Math.round(((latest.value - row.target_max) / row.target_max) * 100);
    }
    return {
      ...row,
      readiness_level: readiness.level,
      latest_actual: latest?.value ?? null,
      variance_pct,
    };
  }
}
