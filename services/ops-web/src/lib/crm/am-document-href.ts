export function isSafeAmDocumentHref(raw: string): boolean {
  const href = raw.trim();
  if (href.startsWith('/') && !href.startsWith('//')) return href.length > 1;
  try {
    const u = new URL(href);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
