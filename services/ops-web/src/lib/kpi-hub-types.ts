import type { HubPerfStatus } from './kpi-hub-status';
import type { KpiHubDictionaryRow, KpiHubDictStatus, KpiHubGroupCode } from './kpi-hub-fixtures';

export type { KpiHubDictionaryRow, KpiHubDictStatus, KpiHubGroupCode };

export type KpiHubDashboardCard = {
  code: string;
  name: string;
  value: number;
  formatted: string;
  deltaPct?: number;
  target?: number;
  status: HubPerfStatus | string;
  badge: string;
  formulaDisplay?: string;
  sourceStatus?: string;
  breakdown?: Array<{ label: string; value: string; pct?: number }>;
};

export type KpiHubDashboardData = {
  periodLabel: string;
  cards: KpiHubDashboardCard[];
  funnel: {
    stages: Array<{ code: string; name: string; value: number; conversion?: string }>;
    bottleneck: { code: string; label: string };
  };
  targetProgress: {
    overallPct: number;
    groups: Array<{ code: string; label: string; pct: number }>;
  };
  channels: Array<{ channel: string; validLeads: number; revenue: number }>;
  alerts: Array<{ level: string; title: string; scope: string; age?: string }>;
  topSales: Array<{ rank: number; name: string; revenue: number; winRate: number }>;
};

export type KpiHubDictSummary = {
  total: number;
  active: number;
  needReview: number;
  sources: number;
};

export type KpiHubTargetRow = {
  id: string;
  code: string;
  name: string;
  actual: number;
  actualFmt: string;
  target: number;
  targetFmt: string;
  warning: number | null;
  critical: number | null;
  trend: 'up' | 'down' | 'flat';
  status: HubPerfStatus | string;
  scopeLevel?: KpiHubTargetScopeLevel;
  scopeLabel?: string;
};

export type KpiHubTargetScopeLevel = 'WORKSPACE' | 'DEPARTMENT' | 'TEAM' | 'CAMPAIGN';

export type KpiHubTargetsData = {
  summary: { configured: number; total: number; achievedPct: number; warning: number; critical: number };
  rows: KpiHubTargetRow[];
};

export type KpiHubFormulaFilter = {
  id: string;
  field: string;
  operator: string;
  value: string;
  join?: 'AND' | 'OR';
};

export type KpiHubFormulaPart = {
  code: string;
  name: string;
  expression: string;
  filter: string;
  filters?: KpiHubFormulaFilter[];
};

export type KpiHubFormulaData = {
  calcType: string;
  numerator: KpiHubFormulaPart;
  denominator: KpiHubFormulaPart;
  businessFormula: string;
  dax: string;
  toggles: { blankIfZero: boolean; nonAdditiveRatio: boolean; manualEntry: boolean };
  sidebar: {
    timeBasis: string;
    logicChecks: string[];
    dependencies: string[];
    upstream?: string[];
    downstream?: string[];
  };
};

export type KpiHubDashboardFilters = {
  department?: string;
  channel?: string;
  product?: string;
  team?: string;
};
