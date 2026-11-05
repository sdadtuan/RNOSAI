import { Injectable } from '@nestjs/common';
import { pipelineRuntimeFromKeys } from '../sales/sales-pipeline.util';
import { CrmConfigPgRepository } from './crm-config-pg.repository';
import type {
  CreateCustomFieldBody,
  CreateLeadLookupBody,
  CreatePipelineStageBody,
  CustomFieldDef,
  LeadLookupKind,
  LeadLookupOption,
  PatchPipelineStageBody,
  PipelineStageDef,
  SalesPipelineConfig,
  UpdateCustomFieldBody,
  UpdateLeadLookupBody,
  UpdatePipelineStagesBody,
} from './crm-config.types';
import { DEFAULT_SALES_PIPELINE_KEY } from './crm-config.defaults';
import type { LeadClassificationConfig, UpdateLeadClassificationBody } from './lead-classification.types';
import { mergeLeadClassificationConfig } from './lead-classification.util';

@Injectable()
export class CrmConfigService {
  private leadClassificationCache: LeadClassificationConfig | null = null;

  constructor(private readonly repo: CrmConfigPgRepository) {}

  async listCustomFields(entityType?: string): Promise<{ fields: CustomFieldDef[] }> {
    return { fields: await this.repo.listCustomFields(entityType) };
  }

  getCustomField(id: number): Promise<CustomFieldDef> {
    return this.repo.getCustomField(id);
  }

  createCustomField(body: CreateCustomFieldBody): Promise<CustomFieldDef> {
    return this.repo.createCustomField(body);
  }

  updateCustomField(id: number, body: UpdateCustomFieldBody): Promise<CustomFieldDef> {
    return this.repo.updateCustomField(id, body);
  }

  deleteCustomField(id: number): Promise<{ ok: true; id: number }> {
    return this.repo.deleteCustomField(id);
  }

  async listSalesPipelineStages(
    includeInactive?: boolean,
  ): Promise<{ pipeline_key: string; stages: PipelineStageDef[] }> {
    const stages = await this.repo.listPipelineStages(DEFAULT_SALES_PIPELINE_KEY, includeInactive);
    return { pipeline_key: DEFAULT_SALES_PIPELINE_KEY, stages };
  }

  createSalesPipelineStage(body: CreatePipelineStageBody): Promise<PipelineStageDef> {
    return this.repo.createPipelineStage(DEFAULT_SALES_PIPELINE_KEY, body);
  }

  patchSalesPipelineStage(stageKey: string, body: PatchPipelineStageBody): Promise<PipelineStageDef> {
    return this.repo.patchPipelineStage(DEFAULT_SALES_PIPELINE_KEY, stageKey, body);
  }

  deleteSalesPipelineStage(stageKey: string): Promise<{ ok: true; stage_key: string }> {
    return this.repo.deletePipelineStage(DEFAULT_SALES_PIPELINE_KEY, stageKey);
  }

  async replaceSalesPipelineStages(
    body: UpdatePipelineStagesBody,
  ): Promise<{ pipeline_key: string; stages: PipelineStageDef[] }> {
    const stages = await this.repo.replacePipelineStages(DEFAULT_SALES_PIPELINE_KEY, body);
    return { pipeline_key: DEFAULT_SALES_PIPELINE_KEY, stages };
  }

  getSalesPipelineConfig(): SalesPipelineConfig {
    return this.repo.getSalesPipelineConfig();
  }

  toPipelineRuntime(config: SalesPipelineConfig = this.getSalesPipelineConfig()) {
    return pipelineRuntimeFromKeys(
      config.stage_keys,
      config.labels,
      config.sla_hours,
      config.owner_roles,
      config.terminal_stages,
    );
  }

  async listLeadLookups(
    kind?: LeadLookupKind,
    activeOnly = false,
  ): Promise<{ options: LeadLookupOption[] }> {
    return { options: await this.repo.listLeadLookups(kind, activeOnly) };
  }

  createLeadLookup(body: CreateLeadLookupBody): Promise<LeadLookupOption> {
    return this.repo.createLeadLookup(body);
  }

  updateLeadLookup(id: number, body: UpdateLeadLookupBody): Promise<LeadLookupOption> {
    return this.repo.updateLeadLookup(id, body);
  }

  deleteLeadLookup(id: number): Promise<{ ok: true; id: number }> {
    return this.repo.deleteLeadLookup(id);
  }

  async getLeadClassificationConfig(force = false): Promise<LeadClassificationConfig> {
    if (!force && this.leadClassificationCache) return this.leadClassificationCache;
    const cfg = await this.repo.fetchLeadClassificationConfig();
    this.leadClassificationCache = cfg;
    return cfg;
  }

  async updateLeadClassificationConfig(
    body: UpdateLeadClassificationBody,
    updatedBy: string,
  ): Promise<LeadClassificationConfig> {
    const current = await this.getLeadClassificationConfig(true);
    const merged = mergeLeadClassificationConfig({
      ...current,
      ...body,
      flows: {
        b2b_prospect: { ...current.flows.b2b_prospect, ...(body.flows?.b2b_prospect ?? {}) },
        spa_operational: { ...current.flows.spa_operational, ...(body.flows?.spa_operational ?? {}) },
      },
      routing_rules: body.routing_rules ?? current.routing_rules,
    });
    const saved = await this.repo.saveLeadClassificationConfig(merged, updatedBy);
    this.leadClassificationCache = saved;
    return saved;
  }
}
