import type { IwrRagHint } from './iwr.types';

export function computeRagHint(input: {
  overdue_p1: number;
  blocker_high: number;
  kpi_below: number;
}): IwrRagHint {
  const reasons: string[] = [];
  if (input.blocker_high >= 1) reasons.push('blocker_high');
  if (input.overdue_p1 >= 1) reasons.push('overdue_p1');
  if (reasons.length > 0) {
    return { rag: 'red', reasons };
  }
  if (input.kpi_below >= 1) {
    return { rag: 'yellow', reasons: ['kpi_below'] };
  }
  return { rag: 'green', reasons: [] };
}
