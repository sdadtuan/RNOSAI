export function loginHrefWithNext(pathAndQuery: string): string {
  if (!pathAndQuery.startsWith('/') || pathAndQuery.startsWith('//')) return '/login';
  return `/login?next=${encodeURIComponent(pathAndQuery)}`;
}
