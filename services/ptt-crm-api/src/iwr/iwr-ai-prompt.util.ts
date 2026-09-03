import { labelForIwrSection } from './iwr-export.util';
import type { IwrReportDetail } from './iwr.types';

export function buildIwrSummarizePrompt(report: IwrReportDetail): string {
  const lines: string[] = [
    `Báo cáo: ${report.title}`,
    `Kỳ: ${report.period_start} — ${report.period_end}`,
    `Trạng thái: ${report.status}`,
    `Mẫu: ${report.template_code}`,
  ];
  for (const [key, sec] of Object.entries(report.sections_json ?? {})) {
    if (!sec || typeof sec !== 'object') continue;
    const body = String((sec as { body?: string }).body ?? '').trim();
    if (!body) continue;
    lines.push(`${labelForIwrSection(key)}: ${body}`);
  }
  return lines.join('\n');
}

export function buildIwrInsights(report: IwrReportDetail): {
  quality: string[];
  risks: string[];
} {
  const quality: string[] = [];
  const risks: string[] = [];
  const sections = report.sections_json ?? {};
  for (const [key, sec] of Object.entries(sections)) {
    const body = String((sec as { body?: string }).body ?? '').trim();
    if (!body) continue;
    if (body.length < 20 && key !== 'rag') {
      quality.push(`Mục "${labelForIwrSection(key)}" quá ngắn.`);
    }
    if (body === '***') continue;
    if (/block|chặn|kẹt/i.test(body) && key === 'blocked') {
      risks.push('Có blocker được ghi nhận.');
    }
    if (/trễ|delay|miss|below/i.test(body) && key === 'kpi') {
      risks.push('KPI có dấu hiệu lệch mục tiêu.');
    }
  }
  if (report.is_late) risks.push('Báo cáo nộp muộn.');
  if (report.rag === 'red') risks.push('RAG đỏ — cần quan tâm.');
  return { quality, risks };
}
