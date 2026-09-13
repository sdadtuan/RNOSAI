export type FlowField = {
  key: string;
  label: string;
  kind: 'text' | 'asset';
};

export type FlowTemplateOption = {
  template_id: string;
  name: string;
  flow_sqid: string;
  estimate_credits: number | null;
  fields: FlowField[];
};

export type MagnificFlowBindingsShape = {
  execution_kind: 'flow';
  flow_sqid: string;
  input_bindings: Record<string, {
    source: string;
    key?: string;
    required?: boolean;
    media_type?: string;
  }>;
};

const FIELD_LABELS: Record<string, string> = {
  image_prompt: 'Prompt ảnh',
  motion_prompt: 'Prompt chuyển động',
  reference_asset_id: 'Ảnh tham chiếu',
};

export function fieldsFromBindings(bindings: MagnificFlowBindingsShape): FlowField[] {
  const fields: FlowField[] = [];
  for (const [apiKey, binding] of Object.entries(bindings.input_bindings ?? {})) {
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

export function buildFlowDraftBody(input: {
  projectId: string;
  templateId: string;
  values: Record<string, string>;
  idempotencyKey?: string;
}) {
  return {
    project_id: input.projectId,
    provider: 'magnific_rest',
    execution_kind: 'flow',
    template_id: input.templateId,
    inputs: input.values,
    idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
  };
}

export function flowTemplateFromApi(item: Record<string, unknown>): FlowTemplateOption {
  return {
    template_id: String(item.template_id ?? ''),
    name: String(item.name ?? '—'),
    flow_sqid: String(item.flow_sqid ?? ''),
    estimate_credits: nullableNumber(item.estimate_credits),
    fields: Array.isArray(item.fields)
      ? item.fields.map((field) => {
        const rec = field as Record<string, unknown>;
        return {
          key: String(rec.key ?? ''),
          label: String(rec.label ?? rec.key ?? '—'),
          kind: rec.kind === 'asset' ? 'asset' as const : 'text' as const,
        };
      }).filter((field) => field.key)
      : [],
  };
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ');
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
