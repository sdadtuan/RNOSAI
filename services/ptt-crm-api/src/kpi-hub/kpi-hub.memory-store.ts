import {
  buildActivityFixtures,
  buildAlertFixtures,
  buildDictionaryFixtures,
  buildQualityIssues,
  buildQualityRules,
  buildReportFixtures,
  buildSourceFixtures,
  buildTargetFixtures,
  buildWorkspaceFixture,
} from './kpi-hub.fixtures';
import type {
  HubAlertEvent,
  HubDictionaryRow,
  HubDictionaryVersionRow,
  HubNotificationRow,
  HubPeriodTargetRow,
  HubQualityIssue,
  HubQualityRule,
  HubQualityRun,
  HubReportRow,
  HubSourceBindingRow,
  HubSourceConnection,
  HubWorkspaceRow,
} from './kpi-hub.types';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Shared in-memory store — used when DB tables empty or unavailable. */
class KpiHubMemoryStore {
  workspace: HubWorkspaceRow;
  dictionary: HubDictionaryRow[];
  sources: HubSourceConnection[];
  targets: HubPeriodTargetRow[];
  alerts: HubAlertEvent[];
  qualityRules: HubQualityRule[];
  qualityIssues: HubQualityIssue[];
  qualityRuns: HubQualityRun[];
  notifications: HubNotificationRow[];
  dictionaryVersions: HubDictionaryVersionRow[];
  dictionaryBindings: Map<string, HubSourceBindingRow[]>;
  reports: HubReportRow[];
  activity = buildActivityFixtures();
  useDb = false;

  constructor() {
    this.dictionary = buildDictionaryFixtures();
    this.workspace = buildWorkspaceFixture();
    this.sources = buildSourceFixtures();
    this.targets = buildTargetFixtures(this.dictionary);
    this.alerts = buildAlertFixtures();
    this.qualityRules = buildQualityRules();
    this.qualityIssues = buildQualityIssues();
    this.qualityRuns = [];
    this.notifications = [];
    this.dictionaryVersions = [];
    this.dictionaryBindings = new Map();
    this.reports = buildReportFixtures();
  }

  reset(): void {
    const fresh = new KpiHubMemoryStore();
    this.workspace = fresh.workspace;
    this.dictionary = fresh.dictionary;
    this.sources = fresh.sources;
    this.targets = fresh.targets;
    this.alerts = fresh.alerts;
    this.qualityRules = fresh.qualityRules;
    this.qualityIssues = fresh.qualityIssues;
    this.qualityRuns = fresh.qualityRuns;
    this.notifications = fresh.notifications;
    this.dictionaryVersions = fresh.dictionaryVersions;
    this.dictionaryBindings = fresh.dictionaryBindings;
    this.reports = fresh.reports;
    this.activity = fresh.activity;
    this.useDb = false;
  }

  snapshotDictionary(): HubDictionaryRow[] {
    return clone(this.dictionary.filter((d) => !d.deleted_at));
  }

  snapshotTargets(): HubPeriodTargetRow[] {
    return clone(this.targets);
  }
}

export const kpiHubMemory = new KpiHubMemoryStore();

/** Returns false when PG is source of truth (prod flag or dictionary rows detected). */
export function shouldUseMemory(): boolean {
  if (process.env.KPI_HUB_USE_MEMORY === '0') return false;
  if (kpiHubMemory.useDb) return false;
  return true;
}

export async function withDbFallback<T>(
  dbFn: () => Promise<T | null>,
  memoryFn: () => T,
): Promise<T> {
  if (!shouldUseMemory()) {
    try {
      const result = await dbFn();
      if (result != null) return result;
    } catch {
      if (process.env.NODE_ENV === 'test') return memoryFn();
      throw new Error('KPI_HUB_DB_UNAVAILABLE');
    }
    return memoryFn();
  }
  try {
    const result = await dbFn();
    if (result != null) {
      kpiHubMemory.useDb = true;
      return result;
    }
  } catch {
    // fall through to memory
  }
  return memoryFn();
}

export function isMissingRelationError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  return msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01');
}

export function markPgActive(): void {
  kpiHubMemory.useDb = true;
}
