import { AiToolDefinition, AiToolExecutionContext } from '../ai-tools.types';
import { StrategyPacksService } from '../../../strategy-packs/strategy-packs.service';

/** P11.a — packs + growth_sections. Không gọi winning plan gate. */
export function createStrategyPackTools(packs: StrategyPacksService): AiToolDefinition[] {
  return [
    {
      name: 'strategy.packs_list',
      description: 'List active industry and service strategy packs. Non-mutating. P11.',
      mutating: false,
      requiredCaps: [],
      inputSchema: { type: 'object', additionalProperties: true, properties: {} },
      handler: async () => packs.packsList(),
    },
    {
      name: 'strategy.pack_get',
      description: 'Read one industry and/or service pack. 404 pack_not_found if the key is unknown. P11.',
      mutating: false,
      requiredCaps: [],
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          industry_pack_key: { type: 'string' },
          service_pack_key: { type: 'string' },
        },
      },
      handler: async (input) =>
        packs.packGet({
          industry_pack_key: input.industry_pack_key as string | undefined,
          service_pack_key: input.service_pack_key as string | undefined,
        }),
    },
    {
      name: 'marketing_plan.sections_read',
      description:
        'Read marketing plan growth_sections. Null storage returns schema v1 shell, fill_pct, and soft warnings. P11.',
      mutating: false,
      requiredCaps: [],
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        required: ['plan_id'],
        properties: { plan_id: { type: 'integer', minimum: 1 } },
      },
      handler: async (input) => packs.sectionsRead(Number(input.plan_id)),
    },
    {
      name: 'marketing_plan.sections_upsert',
      description:
        'Merge growth_sections. Arrays in the patch replace that array. Requires X-AI-Human-Approved unless dry_run. Soft warnings only. P11.',
      mutating: true,
      requiredCaps: [],
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        required: ['plan_id', 'patch'],
        properties: {
          plan_id: { type: 'integer', minimum: 1 },
          mode: { type: 'string' },
          dry_run: { type: 'boolean' },
          patch: { type: 'object' },
        },
      },
      handler: async (input, ctx: AiToolExecutionContext) =>
        packs.sectionsUpsert({
          planId: Number(input.plan_id),
          patch: (input.patch ?? {}) as Record<string, unknown>,
          dryRun: input.dry_run === true,
          humanApproved: Boolean(ctx.humanApproved),
          actor: String(ctx.actorId ?? ctx.apiKeyId ?? 'ai-tool'),
        }),
    },
    {
      name: 'strategy.generate_draft',
      description:
        'Draft growth sections from pack + confirmed TMMT/Insight/Role KPI. Does not invent budget or KPI numbers. persist requires human approval. P11.',
      mutating: true,
      requiredCaps: [],
      inputSchema: {
        type: 'object',
        additionalProperties: true,
        required: ['plan_id'],
        properties: {
          plan_id: { type: 'integer', minimum: 1 },
          lifecycle_id: { type: 'integer', minimum: 1 },
          insight_id: { type: 'integer', minimum: 1 },
          industry_pack_key: { type: 'string' },
          service_pack_key: { type: 'string' },
          overwrite_mode: { type: 'string' },
          dry_run: { type: 'boolean' },
          persist: { type: 'boolean' },
        },
      },
      handler: async (input, ctx: AiToolExecutionContext) =>
        packs.generateDraft({
          planId: Number(input.plan_id),
          lifecycleId: input.lifecycle_id == null ? null : Number(input.lifecycle_id),
          insightId: input.insight_id == null ? null : Number(input.insight_id),
          industryPackKey: input.industry_pack_key == null ? null : String(input.industry_pack_key),
          servicePackKey: input.service_pack_key == null ? null : String(input.service_pack_key),
          overwriteMode: input.overwrite_mode == null ? 'fill_empty_only' : String(input.overwrite_mode),
          dryRun: input.dry_run !== false,
          persist: input.persist === true,
          humanApproved: Boolean(ctx.humanApproved),
          actor: String(ctx.actorId ?? ctx.apiKeyId ?? 'ai-tool'),
        }),
    },
  ];
}
