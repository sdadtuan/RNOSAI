export function dashboardViewQuery(search: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ['scope', 'from', 'to', 'period'] as const) {
    const value = search.get(key);
    if (value) out[key] = value;
  }
  return out;
}

/** True while command-center is in flight and no payload yet. */
export function isAmDashboardLoading(loading: boolean, data: unknown): boolean {
  return loading && data == null;
}

/** Empty copy only after a successful load with zero items. */
export function shouldShowEmptyWidget(
  loading: boolean,
  error: string,
  items: readonly unknown[],
): boolean {
  return !loading && !error && items.length === 0;
}
