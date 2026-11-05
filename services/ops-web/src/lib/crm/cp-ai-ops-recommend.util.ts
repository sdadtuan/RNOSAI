import type { CpAiOpsPane } from './cp-ai-ops-panes.util';

export const CP_RECOMMEND_HUMAN_COPY = 'Người xác nhận. Không tự đốt credit.';

const REASON_VI: Record<string, string> = {
  WEAVE_HUMAN_CANVAS: 'Weave — canvas người',
  RESTRICTED: 'Comfy — asset hạn chế',
  PRIVATE_LORA: 'Comfy — LoRA riêng',
  URGENT_PREMIUM: 'Magnific — gấp, chất lượng',
  PROVIDER_DOWN: 'Provider chưa sẵn',
};

export function formatRecommendReasons(codes: string[]): string {
  const labels = codes
    .map((code) => REASON_VI[code])
    .filter((label): label is string => Boolean(label));
  return labels.length ? labels.join(' · ') : '—';
}

export function recommendPaneOf(provider: string): CpAiOpsPane {
  if (provider === 'magnific_mcp' || provider === 'magnific_rest') return 'magnific';
  if (provider === 'comfyui') return 'comfy';
  return 'weave';
}
