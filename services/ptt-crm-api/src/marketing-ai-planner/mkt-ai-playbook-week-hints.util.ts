export type DoneOpsTaskInput = {
  lifecycleId: number;
  weekNo: number;
  taskName: string;
  status: string;
};

/** Normalize Ops Hub task names for cross-lifecycle matching (template DV). */
export function normalizeOpsTaskName(name: string): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Emit `Tuần N: …` hints only when ≥3 lifecycles have the same Done task
 * (same week_no + normalized name). Skipped/Pending tasks are ignored.
 */
export function buildPlaybookWeekHints(tasks: DoneOpsTaskInput[]): string[] {
  const groups = new Map<
    string,
    { weekNo: number; displayName: string; lifecycleIds: Set<number> }
  >();

  for (const task of tasks) {
    if (String(task.status ?? '').trim().toLowerCase() !== 'done') continue;

    const weekNo = Number(task.weekNo);
    if (!Number.isFinite(weekNo) || weekNo < 0) continue;

    const normalized = normalizeOpsTaskName(task.taskName);
    if (!normalized) continue;

    const key = `${weekNo}:${normalized}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        weekNo,
        displayName: String(task.taskName ?? '').trim(),
        lifecycleIds: new Set<number>(),
      };
      groups.set(key, group);
    }
    group.lifecycleIds.add(task.lifecycleId);
  }

  const hints: string[] = [];
  for (const group of groups.values()) {
    if (group.lifecycleIds.size >= 3) {
      hints.push(`Tuần ${group.weekNo}: ${group.displayName}`);
    }
  }

  return hints.sort((a, b) => {
    const weekA = Number(a.match(/^Tuần (\d+):/)?.[1] ?? 0);
    const weekB = Number(b.match(/^Tuần (\d+):/)?.[1] ?? 0);
    if (weekA !== weekB) return weekA - weekB;
    return a.localeCompare(b, 'vi');
  });
}
