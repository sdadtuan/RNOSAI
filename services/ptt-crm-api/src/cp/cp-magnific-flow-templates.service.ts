import { HttpException, Inject, Injectable, Optional } from '@nestjs/common';
import { CP_TENANT_ID } from './cp-audit.repository';
import { CpAssetsService } from './cp-assets.service';
import {
  flowEstimateCredits,
  parseFlowBindings,
  resolveFlowInputs,
  type MagnificFlowBindings,
} from './cp-magnific-flow-bind.util';
import {
  CpMagnificFlowCacheService,
  CP_MAGNIFIC_FLOW_CACHE_QUERY,
  type CpMagnificFlowCacheQueryPort,
} from './cp-magnific-flow-cache.repository';
import { CpMagnificFlowsAdapter } from './cp-magnific-flows.adapter';

export const CP_FLOW_TEMPLATES_QUERY = 'CP_FLOW_TEMPLATES_QUERY';

export interface CpFlowTemplatesQueryPort {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export type MagnificFlowTemplateItem = {
  template_id: string;
  name: string;
  flow_sqid: string;
  bindings: MagnificFlowBindings;
  estimate_credits: number | null;
  fields: Array<{ key: string; label: string; kind: 'text' | 'asset' }>;
};

@Injectable()
export class CpMagnificFlowTemplatesService {
  constructor(
    @Inject(CP_FLOW_TEMPLATES_QUERY) private readonly db: CpFlowTemplatesQueryPort,
    private readonly cache: CpMagnificFlowCacheService,
    @Optional() private readonly flows?: CpMagnificFlowsAdapter,
    @Optional() private readonly assets?: CpAssetsService,
  ) {}

  async listForProject(): Promise<MagnificFlowTemplateItem[]> {
    const result = await this.db.query(
      `SELECT t.id::text AS template_id,
              t.name,
              m.external_ref AS flow_sqid,
              m.bindings_json
         FROM crm_cp_templates t
         JOIN crm_cp_provider_template_map m ON m.template_id = t.id
        WHERE t.tenant_id = $1
          AND m.provider = 'magnific_rest'
          AND m.active = TRUE
          AND m.bindings_json->>'execution_kind' = 'flow'
        ORDER BY t.name`,
      [CP_TENANT_ID],
    );
    const items: MagnificFlowTemplateItem[] = [];
    for (const row of result.rows) {
      try {
        const bindings = parseFlowBindings(row.bindings_json);
        items.push({
          template_id: String(row.template_id),
          name: String(row.name ?? bindings.flow_sqid),
          flow_sqid: bindings.flow_sqid,
          bindings,
          estimate_credits: flowEstimateCredits(bindings),
          fields: fieldsFromBindings(bindings),
        });
      } catch {
        continue;
      }
    }
    return items;
  }

  async validateDraft(input: {
    template_id: string;
    inputs: Record<string, unknown>;
  }): Promise<{
    flow_inputs: Record<string, string | number>;
    estimate: { credits: number | null; duration_sec: number | null };
    bindings: MagnificFlowBindings;
    flow_sqid: string;
  }> {
    const templateId = String(input.template_id ?? '').trim();
    if (!templateId) cpThrow(422, { error: 'template_id_required' });
    const map = await this.loadTemplateMap(templateId);
    const bindings = parseFlowBindings(map.bindings_json);
    if (bindings.flow_sqid !== String(map.external_ref ?? '').trim()) {
      cpThrow(422, { error: 'flow_template_invalid', gate: 'GT-MF02' });
    }
    try {
      await this.cache.getOrFetch(bindings.flow_sqid);
    } catch (error) {
      if (isFlowNotFound(error)) {
        cpThrow(502, { error: 'magnific_flow_not_found' });
      }
      throw error;
    }
    const flowInputs = await resolveFlowInputs(bindings, objectValue(input.inputs), {
      assetUrl: (assetId) => this.resolveAssetUrl(assetId),
    });
    const detail = await this.cache.get(bindings.flow_sqid);
    const credits = detail?.total_cost ?? flowEstimateCredits(bindings);
    return {
      flow_inputs: flowInputs,
      estimate: { credits, duration_sec: nullableInt(bindings.defaults?.duration_sec) },
      bindings,
      flow_sqid: bindings.flow_sqid,
    };
  }

  async listCatalogFlows(): Promise<Array<{ sqid: string; name: string; total_cost: number | null }>> {
    const templates = await this.listForProject();
    const catalogSqids = new Set(templates.map((item) => item.flow_sqid));
    if (!this.flows || catalogSqids.size === 0) return [];
    const remote = await this.flows.listFlows();
    return remote.filter((item) => catalogSqids.has(item.sqid));
  }

  private async loadTemplateMap(templateId: string): Promise<Record<string, unknown>> {
    const result = await this.db.query(
      `SELECT m.external_ref, m.bindings_json
         FROM crm_cp_provider_template_map m
         JOIN crm_cp_templates t ON t.id = m.template_id
        WHERE t.tenant_id = $1
          AND t.id = $2::uuid
          AND m.provider = 'magnific_rest'
          AND m.active = TRUE
          AND m.bindings_json->>'execution_kind' = 'flow'
        LIMIT 1`,
      [CP_TENANT_ID, templateId],
    );
    const row = result.rows[0];
    if (!row) cpThrow(422, { error: 'flow_template_invalid', gate: 'GT-MF02' });
    return row;
  }

  private async resolveAssetUrl(assetId: string): Promise<string> {
    if (!this.assets) cpThrow(422, { error: 'flow_input_missing', gate: 'GT-MF03' });
    const asset = await this.assets.getAsset(assetId, { scope: 'all', staffId: 0 });
    const url = String(asset?.stream_url ?? asset?.public_url ?? asset?.url ?? '').trim();
    if (!url) cpThrow(422, { error: 'flow_input_missing', gate: 'GT-MF03', field: 'reference_asset_id' });
    return url;
  }
}

export function fieldsFromBindings(
  bindings: MagnificFlowBindings,
): Array<{ key: string; label: string; kind: 'text' | 'asset' }> {
  const fields: Array<{ key: string; label: string; kind: 'text' | 'asset' }> = [];
  for (const [apiKey, binding] of Object.entries(bindings.input_bindings)) {
    if (binding.source === 'prompt_field') {
      const key = String(binding.key ?? apiKey);
      fields.push({ key, label: fieldLabel(key), kind: 'text' });
    } else if (binding.source === 'asset_ref') {
      const key = String(binding.key ?? 'reference_asset_id');
      fields.push({ key, label: fieldLabel(key), kind: 'asset' });
    }
  }
  return fields;
}

function fieldLabel(key: string): string {
  const labels: Record<string, string> = {
    image_prompt: 'Prompt ảnh',
    motion_prompt: 'Prompt chuyển động',
    reference_asset_id: 'Ảnh tham chiếu',
  };
  return labels[key] ?? key.replace(/_/g, ' ');
}

function isFlowNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { error?: unknown }).error === 'magnific_flow_not_found');
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nullableInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
