import type { VdProductionMetricRow, VdProductionReport, VdProjectRow } from '@/lib/video-sop-api';

const ATTENTION_STAGES = new Set([
  'brief_draft',
  'brief_ready',
  'scripting',
  'shotlist_ready',
  'keyframing',
]);

export type VdMetricTile = {
  label: string;
  valueLabel: string;
  onTrack?: boolean;
};

export type VdCommandCenterSummary = {
  activeCount: number;
  stageBuckets: Record<string, number>;
  metricTiles: VdMetricTile[];
  attentionProjects: Array<Pick<VdProjectRow, 'id' | 'title' | 'stage' | 'status'>>;
};

function metricLabel(metric: string): string {
  return metric.replace(/_/g, ' ');
}

function formatMetricValue(row: VdProductionMetricRow): string {
  const name = row.metric.toLowerCase();
  if (name.includes('rate') || name.includes('pct') || name.includes('percent')) {
    return `${row.value}%`;
  }
  if (!Number.isFinite(row.value)) return '—';
  return String(row.value);
}

export function summarizeVdCommandCenter(
  projects: Array<Pick<VdProjectRow, 'id' | 'title' | 'stage' | 'status'>>,
  report: Pick<VdProductionReport, 'metrics'> | null | undefined,
): VdCommandCenterSummary {
  const stageBuckets: Record<string, number> = {};
  let activeCount = 0;
  const attentionProjects: VdCommandCenterSummary['attentionProjects'] = [];

  for (const project of projects) {
    if (project.status === 'active') activeCount += 1;
    stageBuckets[project.stage] = (stageBuckets[project.stage] ?? 0) + 1;
    if (ATTENTION_STAGES.has(project.stage) && project.status !== 'cancelled') {
      attentionProjects.push({
        id: project.id,
        title: project.title,
        stage: project.stage,
        status: project.status,
      });
    }
  }

  const metricTiles: VdMetricTile[] = (report?.metrics ?? []).map((row) => ({
    label: metricLabel(row.metric),
    valueLabel: formatMetricValue(row),
    onTrack: row.on_track,
  }));

  return { activeCount, stageBuckets, metricTiles, attentionProjects };
}
