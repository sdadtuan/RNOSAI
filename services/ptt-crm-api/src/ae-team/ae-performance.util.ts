export type AePerformanceMode = 'all' | 'team' | 'project' | 'self' | 'deny';

export type AePerformanceStageId = 'moi' | 'da_lien_he' | 'dang_tu_van' | 'bao_gia' | 'nurture';

export const AE_PERFORMANCE_STAGES: Array<{ id: AePerformanceStageId; label: string; statuses: string[] }> = [
  { id: 'moi', label: 'Mới', statuses: ['moi', 'new', 'intake'] },
  { id: 'da_lien_he', label: 'Đã liên hệ', statuses: ['da_lien_he', 'first_contact', 'contacted', 'qualified', 'qualify'] },
  { id: 'dang_tu_van', label: 'Đang tư vấn', statuses: ['dang_tu_van', 'nurturing', 'hen_gap'] },
  { id: 'bao_gia', label: 'Báo giá', statuses: ['bao_gia', 'proposal', 'dam_phan', 'negotiation'] },
  { id: 'nurture', label: 'Chăm sóc lại', statuses: ['nurture'] },
];

const WON = new Set(['won', 'chot']);
const LOST = new Set(['lost']);

export type AePerformanceLead = {
  ownerId: number;
  status: string;
  projectId: string | null;
  projectCode: string | null;
  hot: boolean;
  slaBreach: boolean;
  score: number | null;
};

export type AePerformanceOwner = {
  staffId: number;
  name: string;
  code: string;
};

export type AePerformanceProject = { code: string; count: number };

export type AePerformanceRow = {
  staff_id: number;
  name: string;
  code: string;
  total: number;
  projects: AePerformanceProject[];
  stages: Record<AePerformanceStageId, number>;
  open: number;
  lost: number;
  won: number;
  conversion_pct: number;
  sla_breach: number;
  avg_score: number | null;
};

export type AePerformanceBoard = {
  totals: {
    total: number;
    unassigned: number;
    hot: number;
    sla_breach: number;
    conversion_pct: number;
    won: number;
  };
  stages: Array<{ id: AePerformanceStageId; label: string }>;
  projects: Array<{ id: string; code: string }>;
  rows: AePerformanceRow[];
};

function norm(code: string | null | undefined): string {
  return String(code ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

export function isAdminOrCeoPosition(positionCode: string | null | undefined): boolean {
  const code = norm(positionCode);
  return (
    code === 'super-admin' ||
    code === 'super_admin' ||
    code === 'admin' ||
    code === 'ceo' ||
    code.startsWith('ceo-') ||
    code.startsWith('ceo_') ||
    code.startsWith('admin-') ||
    code.startsWith('admin_')
  );
}

export function isGdkdPosition(positionCode: string | null | undefined): boolean {
  const code = norm(positionCode);
  return code === 'gdkd-01' || code === 'gdkd' || code.startsWith('gdkd-') || code.startsWith('gdkd_');
}

export function isAePosition(positionCode: string | null | undefined): boolean {
  const code = norm(positionCode);
  return code === 'ae' || code.startsWith('ae-') || code.startsWith('ae_');
}

/** Admin and CEO see every AE. GDKD sees AEs on a project. Account Manager sees the team. An AE sees only their own leads. */
export function resolveAePerformanceMode(input: {
  positionCode?: string | null;
  accountManager: boolean;
  viewAllCap: boolean;
  teamIds: number[];
}): { mode: AePerformanceMode; note: string } {
  if (isAdminOrCeoPosition(input.positionCode)) {
    return { mode: 'all', note: 'Admin và CEO thấy toàn bộ lead của AE.' };
  }
  if (isGdkdPosition(input.positionCode)) {
    return { mode: 'project', note: 'GDKD thấy AE đang tham gia dự án.' };
  }
  if (input.viewAllCap) {
    return { mode: 'all', note: 'Admin và CEO thấy toàn bộ lead của AE.' };
  }
  if (input.accountManager) {
    return { mode: 'team', note: 'Account Manager thấy lead của AE trong team.' };
  }
  if (isAePosition(input.positionCode)) {
    return { mode: 'self', note: 'AE thấy thống kê lead của mình.' };
  }
  if (input.teamIds.length > 0) {
    return { mode: 'team', note: 'Account Manager thấy lead của AE trong team.' };
  }
  return { mode: 'deny', note: '' };
}

function stageOf(status: string): AePerformanceStageId | 'won' | 'lost' | 'other' {
  const key = status.trim().toLowerCase();
  if (WON.has(key)) return 'won';
  if (LOST.has(key)) return 'lost';
  const match = AE_PERFORMANCE_STAGES.find((stage) => stage.statuses.includes(key));
  return match?.id ?? 'other';
}

function emptyStages(): Record<AePerformanceStageId, number> {
  return { moi: 0, da_lien_he: 0, dang_tu_van: 0, bao_gia: 0, nurture: 0 };
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function buildAePerformanceBoard(
  owners: AePerformanceOwner[],
  leads: AePerformanceLead[],
): AePerformanceBoard {
  const byOwner = new Map<number, AePerformanceLead[]>();
  for (const lead of leads) {
    const list = byOwner.get(lead.ownerId) ?? [];
    list.push(lead);
    byOwner.set(lead.ownerId, list);
  }
  const projectOptions = new Map<string, string>();
  for (const lead of leads) {
    if (lead.projectId && lead.projectCode) projectOptions.set(lead.projectId, lead.projectCode);
  }
  const rows = owners
    .map((owner) => {
      const mine = byOwner.get(owner.staffId) ?? [];
      const stages = emptyStages();
      const projects = new Map<string, number>();
      let won = 0;
      let lost = 0;
      let sla = 0;
      let scoreSum = 0;
      let scoreCount = 0;
      for (const lead of mine) {
        const stage = stageOf(lead.status);
        if (stage === 'won') won += 1;
        else if (stage === 'lost') lost += 1;
        else if (stage !== 'other') stages[stage] += 1;
        if (lead.slaBreach) sla += 1;
        if (lead.score != null && Number.isFinite(lead.score)) {
          scoreSum += lead.score;
          scoreCount += 1;
        }
        if (lead.projectCode) projects.set(lead.projectCode, (projects.get(lead.projectCode) ?? 0) + 1);
      }
      const total = mine.length;
      return {
        staff_id: owner.staffId,
        name: owner.name,
        code: owner.code,
        total,
        projects: [...projects.entries()]
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code, 'vi')),
        stages,
        open: total - won - lost,
        lost,
        won,
        conversion_pct: pct(won, total),
        sla_breach: sla,
        avg_score: scoreCount ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'vi'));

  const total = leads.length;
  const won = leads.filter((lead) => stageOf(lead.status) === 'won').length;
  return {
    totals: {
      total,
      unassigned: leads.filter((lead) => !lead.projectId).length,
      hot: leads.filter((lead) => lead.hot).length,
      sla_breach: leads.filter((lead) => lead.slaBreach).length,
      conversion_pct: pct(won, total),
      won,
    },
    stages: AE_PERFORMANCE_STAGES.map((stage) => ({ id: stage.id, label: stage.label })),
    projects: [...projectOptions.entries()]
      .map(([id, code]) => ({ id, code }))
      .sort((a, b) => a.code.localeCompare(b.code, 'vi')),
    rows,
  };
}
