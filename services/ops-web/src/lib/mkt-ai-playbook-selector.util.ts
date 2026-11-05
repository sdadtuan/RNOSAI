import type { MktAiPlaybookListResult } from '@/lib/mkt-ai-planner-api';

export const MKT_AI_COMMON_PLAYBOOK_SLUG = '_common';

export type MktAiPlaybookListItem = MktAiPlaybookListResult['playbooks'][number];

/** `_common` first, then slug match, then remaining playbooks alphabetically (vi). */
export function orderPlaybooksForSelector(
  playbooks: MktAiPlaybookListItem[],
  serviceSlug?: string,
): MktAiPlaybookListItem[] {
  const bySlug = new Map(playbooks.map((p) => [p.slug, p]));
  const ordered: MktAiPlaybookListItem[] = [];
  const seen = new Set<string>();

  const push = (slug: string) => {
    const row = bySlug.get(slug);
    if (row && !seen.has(slug)) {
      ordered.push(row);
      seen.add(slug);
    }
  };

  push(MKT_AI_COMMON_PLAYBOOK_SLUG);
  if (serviceSlug?.trim()) push(serviceSlug.trim());

  for (const row of [...playbooks].sort((a, b) => a.label_vi.localeCompare(b.label_vi, 'vi'))) {
    if (!seen.has(row.slug)) ordered.push(row);
  }

  return ordered;
}

export function defaultPlaybookSlug(
  data: Pick<MktAiPlaybookListResult, 'active_slug' | 'playbooks'>,
  serviceSlug?: string,
): string {
  const slug = serviceSlug?.trim();
  return (
    data.active_slug ??
    (slug ? data.playbooks.find((p) => p.slug === slug)?.slug : undefined) ??
    data.playbooks.find((p) => p.slug === MKT_AI_COMMON_PLAYBOOK_SLUG)?.slug ??
    data.playbooks[0]?.slug ??
    ''
  );
}
