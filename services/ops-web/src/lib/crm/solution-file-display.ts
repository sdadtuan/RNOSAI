import { formatHistoryClock } from '@/lib/crm/lead-history';

export type SolutionAttachment = {
  id: string;
  name: string;
  mime: string;
  data_url: string;
  size?: number;
  uploaded_by?: string;
  uploaded_at?: string;
};

export function dataUrlByteSize(dataUrl: string | null | undefined): number {
  const raw = String(dataUrl ?? '');
  const comma = raw.indexOf(',');
  const b64 = comma >= 0 ? raw.slice(comma + 1) : raw;
  if (!b64) return 0;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

export function formatFileSize(bytes: number): string {
  const n = Math.max(0, Number(bytes) || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0).replace(/\.0$/, '')} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

export function attachmentByteSize(file: SolutionAttachment): number {
  const declared = Number(file.size);
  if (Number.isFinite(declared) && declared > 0) return declared;
  return dataUrlByteSize(file.data_url);
}

export function formatAttachmentMeta(file: SolutionAttachment): string {
  const parts: string[] = [formatFileSize(attachmentByteSize(file))];
  const who = String(file.uploaded_by ?? '').trim();
  if (who) parts.push(who);
  const when = formatHistoryClock(file.uploaded_at);
  if (when) parts.push(when);
  return parts.join(' · ');
}

/** Busboy stores a UTF-8 multipart filename as Latin-1 code units. */
export function decodeUploadedFileName(name: string): string {
  const text = String(name ?? '').trim();
  if (!text) return text;
  const codes = [...text].map((ch) => ch.codePointAt(0) ?? 0);
  if (codes.some((code) => code > 0xff)) return text;
  if (!codes.some((code) => code >= 0x80)) return text;
  const repaired = new TextDecoder('utf-8', { fatal: false }).decode(Uint8Array.from(codes));
  if (!repaired || repaired.includes('\uFFFD')) return text;
  return repaired;
}

export function readSolutionAttachments(plan: Record<string, unknown> | null): SolutionAttachment[] {
  const raw = plan?.strategy_framework_json ?? plan?.strategy_framework;
  let framework: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    try {
      framework = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      framework = {};
    }
  } else if (raw && typeof raw === 'object') {
    framework = raw as Record<string, unknown>;
  }
  let packed: unknown = framework.mkt_files;
  if (typeof packed === 'string') {
    if (!packed.trim()) return [];
    try {
      packed = JSON.parse(packed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(packed)) return [];
  return packed.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const file = row as Partial<SolutionAttachment>;
    if (!file.name || !file.data_url) return [];
    const size = Number(file.size);
    return [
      {
        id: String(file.id ?? `${file.name}`),
        name: decodeUploadedFileName(String(file.name)),
        mime: String(file.mime ?? 'application/octet-stream'),
        data_url: String(file.data_url),
        size: Number.isFinite(size) && size > 0 ? size : dataUrlByteSize(String(file.data_url)),
        uploaded_by: String(file.uploaded_by ?? '').trim() || undefined,
        uploaded_at: String(file.uploaded_at ?? '').trim() || undefined,
      },
    ];
  });
}

export function buildUploadedAttachment(input: {
  name: string;
  mime?: string;
  dataUrl: string;
  size?: number;
  uploadedBy?: string;
  uploadedAt?: string;
  id?: string;
}): SolutionAttachment {
  const name = decodeUploadedFileName(input.name);
  return {
    id: input.id ?? `${Date.now()}-${name}`,
    name,
    mime: input.mime || 'application/octet-stream',
    data_url: input.dataUrl,
    size: input.size && input.size > 0 ? input.size : dataUrlByteSize(input.dataUrl),
    uploaded_by: String(input.uploadedBy ?? '').trim() || undefined,
    uploaded_at: input.uploadedAt || new Date().toISOString(),
  };
}
