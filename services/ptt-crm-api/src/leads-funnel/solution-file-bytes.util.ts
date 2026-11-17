export const SOLUTION_FILE_MAX_COUNT = 5;

export type SolutionStoredFile = {
  id: string;
  name: string;
  mime: string;
  data_url: string;
  size?: number;
};

export function parseSolutionStoredFiles(raw: unknown): SolutionStoredFile[] {
  let packed: unknown = raw;
  if (packed && typeof packed === 'object' && !Array.isArray(packed)) {
    packed = (packed as { mkt_files?: unknown }).mkt_files ?? packed;
  }
  if (typeof packed === 'string') {
    const text = packed.trim();
    if (!text) return [];
    try {
      packed = JSON.parse(text);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(packed)) return [];
  return packed.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const file = row as Partial<SolutionStoredFile>;
    const name = String(file.name ?? '').trim();
    if (!name) return [];
    return [
      {
        id: String(file.id ?? name),
        name,
        mime: String(file.mime ?? 'application/octet-stream'),
        data_url: String(file.data_url ?? ''),
        size: Number(file.size) > 0 ? Number(file.size) : undefined,
      },
    ];
  });
}

/** Decode a data URL that was stored with the Solution file. Supports base64 and URI-encoded payloads. */
export function decodeSolutionDataUrl(dataUrl: string): Buffer | null {
  const raw = String(dataUrl ?? '').trim();
  const comma = raw.indexOf(',');
  if (!raw.startsWith('data:') || comma < 0) return null;
  const meta = raw.slice(0, comma);
  const payload = raw.slice(comma + 1);
  if (!payload) return null;
  try {
    if (/;base64/i.test(meta)) {
      const buf = Buffer.from(payload, 'base64');
      return buf.length ? buf : null;
    }
    const text = decodeURIComponent(payload);
    return Buffer.from(text, 'utf8');
  } catch {
    return null;
  }
}

export function solutionFileMime(file: SolutionStoredFile): string {
  const fromField = String(file.mime ?? '').trim();
  if (fromField && fromField !== 'application/octet-stream') return fromField;
  const match = /^data:([^;,]+)/i.exec(String(file.data_url ?? ''));
  return match?.[1] || fromField || 'application/octet-stream';
}

export function solutionFileDisposition(mime: string, name: string, mode: 'open' | 'download'): string {
  const safe = String(name || 'solution').replace(/["\r\n]/g, '');
  const inline = mode === 'open' && /^(application\/pdf|text\/|image\/)/i.test(mime);
  return `${inline ? 'inline' : 'attachment'}; filename="${safe}"`;
}
