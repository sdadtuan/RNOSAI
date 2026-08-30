export function buildLoraJsonlLine(input: {
  systemPrompt: string;
  userContent: string;
  assistant: string;
}): string {
  return JSON.stringify({
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userContent },
      { role: 'assistant', content: input.assistant },
    ],
  });
}

export function canStartLora(opts: {
  pairs: number;
  minPairs: number;
  enabled: boolean;
}): { ok: boolean; error?: string } {
  if (!opts.enabled) {
    return { ok: false, error: 'PTT_SALES_KIT_LORA_ENABLED!=1' };
  }
  if (opts.pairs < opts.minPairs) {
    return { ok: false, error: `pairs=${opts.pairs} min=${opts.minPairs}` };
  }
  return { ok: true };
}

export function shouldExportTurn(input: {
  rating: string | null;
  stub_mode: boolean;
  reply_vi: string;
}): boolean {
  if (input.rating === 'down') return false;
  if (input.stub_mode) return false;
  if (String(input.reply_vi ?? '').includes('[số đã ẩn]')) return false;
  return input.rating === 'up';
}
