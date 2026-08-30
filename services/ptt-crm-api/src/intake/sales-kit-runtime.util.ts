export type SalesKitLlmMode = 'off' | 'openai' | 'ollama';

const VALID: SalesKitLlmMode[] = ['off', 'openai', 'ollama'];

export function parseSalesKitMode(raw: string | null | undefined): SalesKitLlmMode | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return null;
  return (VALID as string[]).includes(v) ? (v as SalesKitLlmMode) : null;
}

export function resolveKitMode(input: {
  locked: boolean;
  envMode: string | null;
  legacyOn: boolean;
  dbMode: SalesKitLlmMode | null;
}): SalesKitLlmMode {
  if (input.locked) {
    return parseSalesKitMode(input.envMode) ?? 'off';
  }
  if (input.dbMode) return input.dbMode;
  const fromEnv = parseSalesKitMode(input.envMode);
  if (fromEnv) return fromEnv;
  if (input.legacyOn) return 'openai';
  return 'off';
}

export function kitRuntimeHint(mode: SalesKitLlmMode, healthy: boolean): string {
  if (mode === 'off') return 'Chế độ Rules — không gọi model.';
  if (mode === 'openai' && !healthy) {
    return 'Thiếu API key — kit vẫn trả lời bằng Rules (stub).';
  }
  if (mode === 'ollama' && !healthy) {
    return 'Ollama chưa sẵn sàng — kit giữ Rules. VPS nhỏ không chạy 7B trên cùng máy.';
  }
  if (mode === 'openai') return 'LLM cloud đang bật.';
  return 'Ollama / OSS đang bật.';
}

export type SalesKitRuntimeDto = {
  mode: SalesKitLlmMode;
  locked: boolean;
  healthy: boolean;
  hint_vi: string;
};
