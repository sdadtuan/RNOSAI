export type InsightCopilotEvidence = {
  id: number;
  locator: string;
  excerpt: string | null;
  value: number | null;
  unit: string | null;
  period: string | null;
  geo: string | null;
};

export type InsightCopilotEvidenceSource = {
  id: number;
  locator: string;
  excerpt: string | null;
  value_num: number | null;
  unit: string | null;
  period_note: string | null;
  geography: string | null;
  pii_class?: string;
  [key: string]: unknown;
};

export type ReportCopilotInsight = {
  id: number;
  statement: string;
  observation: string | null;
  interpretation: string | null;
  implication: string | null;
  recommendation: string | null;
  evidence_ids: number[];
};

export function toInsightCopilotEvidenceFields(
  ev: InsightCopilotEvidenceSource,
): InsightCopilotEvidence {
  return {
    id: ev.id,
    locator: ev.locator,
    excerpt: ev.excerpt,
    value: ev.value_num,
    unit: ev.unit,
    period: ev.period_note,
    geo: ev.geography,
  };
}

export function redactEvidenceForAiRunLog(
  ev: InsightCopilotEvidenceSource,
): InsightCopilotEvidence {
  const fields = toInsightCopilotEvidenceFields(ev);
  if (ev.pii_class && ev.pii_class !== 'none') {
    return { ...fields, excerpt: '[redacted]', value: null };
  }
  return fields;
}

export function buildInsightCopilotPrompt(evidence: InsightCopilotEvidence[]): {
  system: string;
  user: string;
} {
  const grounded = evidence.map((row) => {
    const next: InsightCopilotEvidence = {
      id: row.id,
      locator: row.locator,
      excerpt: row.excerpt,
      value: row.value,
      unit: row.unit,
      period: row.period,
      geo: row.geo,
    };
    return next;
  });
  return {
    system: [
      'You are a market-research insight copilot (G6).',
      'Use only the supplied evidence objects — fields id, locator, excerpt, value, unit, period, geo.',
      'Do not fill gaps. Do not invent numbers, sources, geographies, or recommendations beyond the evidence.',
      'Cấm fill gaps — chỉ dùng evidence đã chọn.',
      'Return JSON only with keys: statement, observation, interpretation, implication, recommendation, confidence_rationale.',
      'Never set status published. Output is a draft for an analyst to edit.',
    ].join(' '),
    user: JSON.stringify(grounded),
  };
}

export function buildReportCopilotPrompt(insights: ReportCopilotInsight[]): {
  system: string;
  user: string;
} {
  const payload = insights.map((row) => ({
    id: row.id,
    statement: row.statement,
    observation: row.observation,
    interpretation: row.interpretation,
    implication: row.implication,
    recommendation: row.recommendation,
    evidence_ids: row.evidence_ids,
  }));
  return {
    system: [
      'You are a market-research report copilot (G7).',
      'Write a draft report outline only from the approved insights provided.',
      'Do not fill gaps. Do not publish. Do not add findings without an insight id.',
      'Return JSON with keys: cover, exec, findings, recs, methodology, evidence_index.',
      'methodology must remain a P0 CB stub. status must stay draft.',
    ].join(' '),
    user: JSON.stringify(payload),
  };
}
