const PLACEHOLDERS = new Set(['[cần chốt]', '[cần xác nhận]']);

export function briefFieldFilled(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return text.length > 0 && !PLACEHOLDERS.has(text);
}

/** Labels match the API `clientBriefMissing` list. Audience and competitors are not required. */
export function clientBriefUiMissing(input: {
  company_name?: string | null;
  niche?: string | null;
  need?: string | null;
  usp?: string | null;
  goal?: string | null;
  channels?: string | null;
}): string[] {
  const checks: Array<[string, unknown]> = [
    ['Tên công ty trên hồ sơ lead', input.company_name],
    ['Ngành KH', input.niche],
    ['Nhu cầu cụ thể', input.need],
    ['Điểm khác biệt', input.usp],
    ['Mục tiêu đo được', input.goal],
    ['Kênh muốn chạy và cách chốt đơn', input.channels],
  ];
  return checks.filter(([, value]) => !briefFieldFilled(value)).map(([label]) => label);
}

export function showClientPlanExportButton(g4Messages: readonly string[]): boolean {
  return g4Messages.length === 0;
}

const G4_STRATEGY_VI: Record<string, string> = {
  market_message: 'Nhập Thông điệp thị trường.',
  media_reach: 'Nhập Kênh tiếp cận.',
  conversion_strategy: 'Nhập Chiến lược chuyển đổi.',
};

export function g4MessagesVi(messages: readonly string[]): string[] {
  return messages.map((message) => {
    if (message === 'Nhập tên kế hoạch MKT sơ bộ.') return 'Nhập tên kế hoạch.';
    const key = message.match(/^Điền khối chiến lược: ([a-z_]+)\.$/)?.[1];
    if (key && G4_STRATEGY_VI[key]) return G4_STRATEGY_VI[key];
    return message;
  });
}

export function mergeHumanEditedKeys(current: readonly string[], dirty: readonly string[]): string[] {
  const out: string[] = [];
  for (const key of [...current, ...dirty]) {
    const trimmed = key.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

export function clientPlanDraftModelLine(model: string | null | undefined, hasPublicPage = false): string {
  const name = String(model ?? '').trim();
  if (!name) return '';
  if (name === 'gpt-4o-mini' && !hasPublicPage) return 'Không có website/fanpage. Một lần gọi gpt-4o-mini.';
  return `Một lần gọi ${name}.`;
}

export function factsFromBriefMissing(missing: readonly string[]): {
  company_name: string;
  niche: string;
  need: string;
} {
  const has = (label: string) => (missing.includes(label) ? '' : 'đã có');
  return {
    company_name: has('Tên công ty trên hồ sơ lead'),
    niche: has('Ngành KH'),
    need: has('Nhu cầu cụ thể'),
  };
}

export function decodeBase64Bytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function clientPlanPptxBlob(base64: string): Blob {
  const bytes = decodeBase64Bytes(base64);
  return new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

export function downloadNamedBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
