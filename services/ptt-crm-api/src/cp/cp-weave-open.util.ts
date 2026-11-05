export function buildWeaveOpenUrl(input: {
  base: string;
  templateUrl: string | null;
  workOrderId: string;
  projectId: string;
}): { href: string; copied_brief: boolean } {
  const template = String(input.templateUrl ?? '').trim();
  const base = String(input.base ?? '').trim() || 'https://app.weavy.ai/';
  const raw = template || base;
  const url = new URL(raw);
  url.searchParams.set('wo', input.workOrderId);
  url.searchParams.set('project', input.projectId);
  return { href: url.toString(), copied_brief: false };
}
