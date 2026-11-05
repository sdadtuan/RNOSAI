export type MsosDraftKind = 'io' | 'traffic' | 'discrepancy';

export type MsosDraftFacts = Record<string, unknown>;

export type MsosDraftResult = {
  text: string;
  facts: MsosDraftFacts;
  actor: 'template_a1';
};

function fmtQty(value: unknown): string {
  if (value == null || value === '') return 'chưa có report';
  return String(value);
}

export function buildDraft(kind: MsosDraftKind, facts: MsosDraftFacts): MsosDraftResult {
  const code = String(facts.display_code ?? '—');

  if (kind === 'io') {
    const ioQty = facts.io_qty;
    const rateVersion = facts.rate_version ?? '—';
    const reportQty = facts.report_qty;
    const text = [
      `[A1 IO draft] Media line ${code}`,
      `Plan qty: ${fmtQty(ioQty)}`,
      `Rate version: ${rateVersion}`,
      `Report: ${fmtQty(reportQty)}`,
    ].join('\n');
    return { text, facts, actor: 'template_a1' };
  }

  if (kind === 'traffic') {
    const status = facts.traffic_status ?? 'chưa có';
    const clickUrl = facts.click_url ?? 'chưa có URL';
    const text = [
      `[A1 Traffic draft] Media line ${code}`,
      `Traffic status: ${status}`,
      `Click URL: ${clickUrl}`,
    ].join('\n');
    return { text, facts, actor: 'template_a1' };
  }

  const ioQty = facts.io_qty;
  const reportQty = facts.report_qty;
  const material = facts.material ? 'có' : 'không';
  const text = [
    `[A1 Discrepancy draft] Media line ${code}`,
    `IO qty: ${fmtQty(ioQty)}`,
    `Report qty: ${fmtQty(reportQty)}`,
    `Material: ${material}`,
  ].join('\n');
  return { text, facts, actor: 'template_a1' };
}
