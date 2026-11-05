const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export function brandFileUrl(
  publicBase: string,
  kind: 'logo' | 'hero',
  filename: string,
  updatedAt: string,
): string {
  const base = publicBase.replace(/\/$/, '');
  return `${base}/api/v1/public/brand/files/${kind}/${encodeURIComponent(filename)}?v=${encodeURIComponent(updatedAt)}`;
}

export function assertImageUpload(file: { mimetype: string; size: number }, maxBytes: number): void {
  if (!ALLOWED.has(file.mimetype)) {
    throw new Error('invalid_image');
  }
  if (file.size > maxBytes) {
    throw new Error('file_too_large');
  }
}

export function assertCanDeleteHero(activeHeroId: string, targetId: string): void {
  if (activeHeroId === targetId) throw new Error('hero_in_use');
}

export function contentTypeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}
