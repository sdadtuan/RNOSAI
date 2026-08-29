export const ORG_KIND_FOLDERS = ['qa', 'battle-cards', 'cases', 'pricing'] as const;

export const ALLOWED_SALES_KIT_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

const SIZE_CAP: Record<string, number> = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 2 * 1024 * 1024,
  'application/pdf': 8 * 1024 * 1024,
  'image/png': 4 * 1024 * 1024,
  'image/jpeg': 4 * 1024 * 1024,
  'image/webp': 4 * 1024 * 1024,
};

export function folderKeyOk(key: string): boolean {
  const parts = String(key ?? '')
    .split('/')
    .filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return false;
  return parts.every((p, i) => {
    if (i === 0 && p === '_common') return true;
    if (i === 0 && p === 'session') return false;
    return /^[a-z0-9][a-z0-9-_]*$/.test(p);
  });
}

export function playbookSlugForFolder(folderKey: string): string {
  return `sk-${folderKey.replace(/\//g, '-')}`;
}

export function sessionFolderKey(leadId: number, sessionId: number): string {
  return `session/${leadId}/${sessionId}`;
}

export function salesKitFileTooLarge(mime: string, bytes: number): boolean {
  const cap = SIZE_CAP[mime];
  if (!cap) return true;
  return bytes > cap;
}

export function isAllowedSalesKitMime(mime: string): boolean {
  return (ALLOWED_SALES_KIT_MIME as readonly string[]).includes(mime);
}
