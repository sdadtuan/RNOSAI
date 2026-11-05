export function roasDisplay(input: { attribution_ready: boolean; value: number | null }) {
  if (!input.attribution_ready) {
    return { value: null, display: 'N/A', reason: 'Thiếu attribution model' };
  }
  return { value: input.value, display: input.value == null ? '—' : String(input.value), reason: null };
}

export function funnelStage(input: {
  label: string;
  mapped: boolean;
  value?: number | null;
  hint?: string;
}) {
  if (!input.mapped) {
    return { label: input.label, value: null, display: '—', hint: 'Chưa map Sales CRM' };
  }
  return {
    label: input.label,
    value: input.value ?? null,
    display: input.value == null ? '—' : String(input.value),
    hint: input.hint ?? '',
  };
}
