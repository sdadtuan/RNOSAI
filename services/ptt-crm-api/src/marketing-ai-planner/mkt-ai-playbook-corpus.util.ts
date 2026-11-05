import type { DoneOpsTaskInput } from './mkt-ai-playbook-week-hints.util';

export type CorpusLifecycleInput = {
  lifecycleId: number;
  serviceSlug: string;
  applied: boolean;
  qualityScore: number;
  humanEditedAfterGenerate: boolean;
  isUatSeed: boolean;
  sqliteLeadId?: number;
  stage: string;
  closedLoopWin: boolean; // W1
  /** Ops Done | Launch QA pass | Content approved_internal (§7.0.5). */
  hasTier3Artifact: boolean;
  doneOpsTasks?: DoneOpsTaskInput[];
};

export function classifyCorpus(slug: string, rows: CorpusLifecycleInput[]) {
  const candidates = rows.filter(
    (r) =>
      r.serviceSlug === slug &&
      r.applied &&
      r.qualityScore >= 70 &&
      r.humanEditedAfterGenerate &&
      !r.isUatSeed &&
      (r.sqliteLeadId == null || r.sqliteLeadId < 900000901),
  );
  const winners = candidates.filter((r) => r.closedLoopWin);
  const canLearn = candidates.length >= 5;
  const deep =
    winners.length >= 3 && winners.filter((r) => r.hasTier3Artifact).length >= 3;
  return {
    candidates,
    winners,
    depth: deep ? 'deep' : 'shallow',
    canLearn,
    remaining: Math.max(0, 5 - candidates.length),
  };
}
