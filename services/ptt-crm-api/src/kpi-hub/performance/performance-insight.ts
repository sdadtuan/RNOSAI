export function visibleInsights<T extends { evidence_ids: string[] }>(items: T[]): T[] {
  return items.filter((i) => i.evidence_ids.length > 0);
}

export function assertForecastPublishable(input: {
  client_facing: boolean;
  disclaimer: string;
}) {
  if (input.client_facing && !input.disclaimer.trim()) {
    throw new Error('forecast_disclaimer_required');
  }
}
