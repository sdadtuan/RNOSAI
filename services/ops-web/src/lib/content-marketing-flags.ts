/** FE gate — match API PTT_CONTENT_MARKETING_FE on staging/prod. */
export function isContentMarketingFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_CONTENT_MARKETING ?? '0').trim().toLowerCase(),
  );
}

/** Optional FE copy of API `PTT_CONTENT_MARKETING_SLUGS`. Empty = do not filter on the client. */
export function contentMarketingPilotSlugs(): string[] {
  return (process.env.NEXT_PUBLIC_CONTENT_MARKETING_SLUGS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isContentOsLifecycleEligible(
  serviceSlug: string,
  allowlist: string[] = contentMarketingPilotSlugs(),
): boolean {
  if (allowlist.length === 0) return true;
  return allowlist.includes(serviceSlug);
}
