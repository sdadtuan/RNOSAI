import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEAL_FILE_MAX_BYTES = 20 * 1024 * 1024;

export type DealFileKind = 'quote' | 'contract';
export type DealFileSource = 'export' | 'upload';

export type LeadDealFileRow = {
  id: number;
  lead_id: number;
  kind: DealFileKind;
  version_n: number;
  file_name: string;
  mime_type: string;
  byte_size: number;
  source: DealFileSource;
  uploaded_by_staff_id: number | null;
  uploaded_by_name: string;
  uploaded_by_email: string;
  created_at: string;
};

export const QUOTE_XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const CONTRACT_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PDF_MIME = 'application/pdf';

export const LEAD_DEAL_FILES_DDL = `
CREATE TABLE IF NOT EXISTS crm_lead_deal_files (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('quote', 'contract')),
  version_n INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('export', 'upload')),
  uploaded_by_staff_id INTEGER,
  uploaded_by_name TEXT NOT NULL DEFAULT '',
  uploaded_by_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

export const LEAD_DEAL_FILES_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS crm_lead_deal_files_lead_kind_idx
  ON crm_lead_deal_files (lead_id, kind, version_n DESC, id DESC)
`;

export function dealFilesRoot(): string {
  return join(process.cwd(), 'data', 'lead-deal-files');
}

export function quoteVersionFileName(leadId: number, version: number): string {
  const n = Number.isFinite(version) && version > 0 ? Math.floor(version) : 1;
  return `bao-gia-${leadId}-v${n}.xlsx`;
}

/** Content-Disposition that keeps the stored file name, including non-ASCII. */
export function contentDispositionAttachment(
  filename: string,
  mode: 'attachment' | 'inline' = 'attachment',
): string {
  const cleaned = String(filename ?? '').replace(/[\r\n"]/g, '').trim() || 'file';
  const ascii = cleaned.replace(/[^\x20-\x7E]/g, '_') || 'file';
  const encoded = encodeURIComponent(cleaned).replace(/['()*]/g, (ch) =>
    `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Busboy stores a UTF-8 multipart filename as Latin-1 code units. */
export function decodeMultipartFileName(name: string): string {
  const text = String(name ?? '').trim();
  if (!text) return text;
  const codes = [...text].map((ch) => ch.codePointAt(0) ?? 0);
  if (codes.some((code) => code > 0xff)) return text;
  if (!codes.some((code) => code >= 0x80)) return text;
  const repaired = Buffer.from(text, 'latin1').toString('utf8');
  if (!repaired || repaired.includes('\uFFFD')) return text;
  return repaired;
}

export function safeDealFileName(name: string): string {
  const base = String(name ?? '')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
  return base || 'file';
}

export function detectDealUpload(
  kind: DealFileKind,
  originalName: string,
  mimeType: string,
): { mime: string; ext: string } | null {
  const name = String(originalName ?? '').trim().toLowerCase();
  const mime = String(mimeType ?? '').trim().toLowerCase();
  const ext = (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '').toLowerCase();
  if (kind === 'quote') {
    if (ext === 'xlsx' || mime === QUOTE_XLSX_MIME) return { mime: QUOTE_XLSX_MIME, ext: 'xlsx' };
    if (ext === 'pdf' || mime === PDF_MIME) return { mime: PDF_MIME, ext: 'pdf' };
    return null;
  }
  if (ext === 'docx' || mime === CONTRACT_DOCX_MIME) return { mime: CONTRACT_DOCX_MIME, ext: 'docx' };
  if (ext === 'pdf' || mime === PDF_MIME) return { mime: PDF_MIME, ext: 'pdf' };
  return null;
}

export function writeDealFileToDisk(input: {
  leadId: number;
  kind: DealFileKind;
  version: number;
  fileName: string;
  buffer: Buffer;
}): string {
  const dir = join(dealFilesRoot(), String(input.leadId), input.kind);
  mkdirSync(dir, { recursive: true });
  const stamp = Date.now();
  const dest = join(dir, `${input.version}-${stamp}-${safeDealFileName(input.fileName)}`);
  writeFileSync(dest, input.buffer);
  return dest;
}

export function readDealFileFromDisk(storagePath: string): Buffer {
  return readFileSync(storagePath);
}

export function mapDealFileRow(row: Record<string, unknown>): LeadDealFileRow {
  const kind = String(row.kind ?? '') === 'contract' ? 'contract' : 'quote';
  const source = String(row.source ?? '') === 'upload' ? 'upload' : 'export';
  const staffId = Number(row.uploaded_by_staff_id);
  return {
    id: Number(row.id),
    lead_id: Number(row.lead_id),
    kind,
    version_n: Number(row.version_n) || 1,
    file_name: String(row.file_name ?? ''),
    mime_type: String(row.mime_type ?? ''),
    byte_size: Number(row.byte_size) || 0,
    source,
    uploaded_by_staff_id: Number.isFinite(staffId) && staffId > 0 ? staffId : null,
    uploaded_by_name: String(row.uploaded_by_name ?? '').trim(),
    uploaded_by_email: String(row.uploaded_by_email ?? '').trim(),
    created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : new Date().toISOString(),
  };
}
