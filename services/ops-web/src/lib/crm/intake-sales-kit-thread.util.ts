export type SalesKitMode = 'off' | 'openai' | 'ollama';

export function kitBadge(opts: {
  mode: SalesKitMode;
  stubMode: boolean;
}): 'Rules' | 'LLM' | 'Ollama' | 'Stub' {
  if (opts.mode === 'off') return 'Rules';
  if (opts.stubMode) return 'Stub';
  return opts.mode === 'openai' ? 'LLM' : 'Ollama';
}

export function chipUserLabel(intent: string, message?: string): string {
  const labels: Record<string, string> = {
    next_question: 'Câu tiếp theo',
    gap_to_go: 'Còn thiếu để Go',
    win_intel: 'Win intel',
    service_dive: 'Deep-dive dịch vụ',
    summary_30s: 'Tóm tắt 30s',
    red_flag: 'Red flag',
    ask_library: 'Hỏi kho / Q&A',
    pricing_band: 'Bảng giá / band',
    freeform: message?.trim() || 'Hỏi kit',
  };
  if (intent === 'ask_library' || intent === 'freeform') {
    return message?.trim() || labels[intent]!;
  }
  return labels[intent] ?? intent;
}

export function composerIntent(activeIntent: string | null, message: string): string {
  const text = message.trim();
  if (activeIntent === 'ask_library' || activeIntent === 'pricing_band') {
    return activeIntent;
  }
  return 'freeform';
}
