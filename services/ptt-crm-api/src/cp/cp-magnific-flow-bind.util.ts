import { HttpException } from '@nestjs/common';

export type FlowInputBindingSource = 'prompt_field' | 'asset_ref' | 'literal' | 'brand_kit';

export type FlowInputBinding = {
  source: FlowInputBindingSource;
  key?: string;
  required?: boolean;
  media_type?: 'image';
  value?: unknown;
};

export type MagnificFlowBindings = {
  execution_kind: 'flow';
  flow_sqid: string;
  input_bindings: Record<string, FlowInputBinding>;
  defaults?: Record<string, unknown>;
  estimate_credits?: number;
  requires_render_high_cost?: boolean;
  output_expectation?: { videos_min?: number; mime?: string[] };
};

export type ResolveFlowInputsContext = {
  assetUrl?: (assetId: string) => Promise<string>;
};

const BINDING_SOURCES = new Set<FlowInputBindingSource>([
  'prompt_field',
  'asset_ref',
  'literal',
  'brand_kit',
]);

export function parseFlowBindings(raw: unknown): MagnificFlowBindings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    cpThrow(422, { error: 'flow_template_invalid', gate: 'GT-MF02' });
  }
  const doc = raw as Record<string, unknown>;
  if (String(doc.execution_kind ?? '').trim() !== 'flow') {
    cpThrow(422, { error: 'flow_template_invalid', gate: 'GT-MF02' });
  }
  const flowSqid = String(doc.flow_sqid ?? '').trim();
  if (!flowSqid) {
    cpThrow(422, { error: 'flow_template_invalid', gate: 'GT-MF02' });
  }
  const inputBindings = parseInputBindings(doc.input_bindings);
  const defaults = parseDefaults(doc.defaults);
  const estimateCredits = parseOptionalInt(doc.estimate_credits);
  const requiresRenderHighCost =
    doc.requires_render_high_cost === true || doc.requires_render_high_cost === 'true';
  const outputExpectation = parseOutputExpectation(doc.output_expectation);

  return {
    execution_kind: 'flow',
    flow_sqid: flowSqid,
    input_bindings: inputBindings,
    ...(defaults ? { defaults } : {}),
    ...(estimateCredits != null ? { estimate_credits: estimateCredits } : {}),
    ...(requiresRenderHighCost ? { requires_render_high_cost: true } : {}),
    ...(outputExpectation ? { output_expectation: outputExpectation } : {}),
  };
}

export async function resolveFlowInputs(
  bindings: MagnificFlowBindings,
  composer: Record<string, unknown>,
  ctx: ResolveFlowInputsContext = {},
): Promise<Record<string, string | number>> {
  const resolved: Record<string, string | number> = {};

  for (const [apiKey, binding] of Object.entries(bindings.input_bindings)) {
    const value = await resolveBindingValue(apiKey, binding, composer, bindings.defaults, ctx);
    if (value == null || value === '') {
      if (binding.required === true) {
        cpThrow(422, {
          error: 'flow_input_missing',
          gate: 'GT-MF03',
          field: apiKey,
        });
      }
      continue;
    }
    resolved[apiKey] = value;
  }

  mergeDefaultLiterals(resolved, bindings.defaults, bindings.input_bindings);
  return resolved;
}

export function flowEstimateCredits(bindings: MagnificFlowBindings): number | null {
  if (typeof bindings.estimate_credits === 'number' && Number.isFinite(bindings.estimate_credits)) {
    return bindings.estimate_credits;
  }
  return null;
}

async function resolveBindingValue(
  apiKey: string,
  binding: FlowInputBinding,
  composer: Record<string, unknown>,
  defaults: Record<string, unknown> | undefined,
  ctx: ResolveFlowInputsContext,
): Promise<string | number | null> {
  switch (binding.source) {
    case 'prompt_field': {
      const fieldKey = String(binding.key ?? apiKey).trim();
      return normalizeScalar(composer[fieldKey]);
    }
    case 'asset_ref': {
      const fieldKey = String(binding.key ?? 'reference_asset_id').trim();
      const assetId = String(composer[fieldKey] ?? '').trim();
      if (!assetId) return null;
      if (!ctx.assetUrl) return null;
      const url = String(await ctx.assetUrl(assetId)).trim();
      return url || null;
    }
    case 'literal': {
      const literal = binding.value ?? defaults?.[apiKey] ?? defaults?.[String(binding.key ?? '')];
      return normalizeScalar(literal);
    }
    case 'brand_kit':
      cpThrow(422, { error: 'flow_binding_unsupported', source: 'brand_kit' });
    default:
      cpThrow(422, { error: 'flow_template_invalid', gate: 'GT-MF02' });
  }
}

function mergeDefaultLiterals(
  resolved: Record<string, string | number>,
  defaults: Record<string, unknown> | undefined,
  inputBindings: Record<string, FlowInputBinding>,
): void {
  if (!defaults) return;
  for (const [key, value] of Object.entries(defaults)) {
    if (Object.prototype.hasOwnProperty.call(resolved, key)) continue;
    if (Object.prototype.hasOwnProperty.call(inputBindings, key)) continue;
    const scalar = normalizeScalar(value);
    if (scalar != null && scalar !== '') {
      resolved[key] = scalar;
    }
  }
}

function parseInputBindings(raw: unknown): Record<string, FlowInputBinding> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    cpThrow(422, { error: 'flow_template_invalid', gate: 'GT-MF02' });
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) {
    cpThrow(422, { error: 'flow_template_invalid', gate: 'GT-MF02' });
  }
  const out: Record<string, FlowInputBinding> = {};
  for (const [apiKey, value] of entries) {
    const key = String(apiKey ?? '').trim();
    if (!key) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      cpThrow(422, { error: 'flow_template_invalid', gate: 'GT-MF02' });
    }
    const binding = value as Record<string, unknown>;
    const source = String(binding.source ?? '').trim() as FlowInputBindingSource;
    if (!BINDING_SOURCES.has(source)) {
      cpThrow(422, { error: 'flow_template_invalid', gate: 'GT-MF02' });
    }
    out[key] = {
      source,
      ...(binding.key != null ? { key: String(binding.key) } : {}),
      ...(binding.required === true ? { required: true } : {}),
      ...(binding.media_type === 'image' ? { media_type: 'image' as const } : {}),
      ...(Object.prototype.hasOwnProperty.call(binding, 'value') ? { value: binding.value } : {}),
    };
  }
  if (Object.keys(out).length === 0) {
    cpThrow(422, { error: 'flow_template_invalid', gate: 'GT-MF02' });
  }
  return out;
}

function parseDefaults(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    cpThrow(422, { error: 'flow_template_invalid', gate: 'GT-MF02' });
  }
  return { ...(raw as Record<string, unknown>) };
}

function parseOptionalInt(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseOutputExpectation(
  raw: unknown,
): MagnificFlowBindings['output_expectation'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const doc = raw as Record<string, unknown>;
  const videosMin = parseOptionalInt(doc.videos_min);
  const mime = Array.isArray(doc.mime)
    ? doc.mime.map((item) => String(item ?? '').trim()).filter(Boolean)
    : undefined;
  if (videosMin == null && (!mime || mime.length === 0)) return undefined;
  return {
    ...(videosMin != null ? { videos_min: videosMin } : {}),
    ...(mime && mime.length > 0 ? { mime } : {}),
  };
}

function normalizeScalar(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = String(value).trim();
  return text || null;
}

function cpThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
