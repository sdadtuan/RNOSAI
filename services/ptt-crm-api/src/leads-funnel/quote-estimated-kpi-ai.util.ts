import { createHash } from 'node:crypto';
import type { QuoteCampaignKpiCells } from './lead-quote-xlsx';
import type { QuoteSheetView } from './quote-sheet.util';

export const QUOTE_KPI_AI_TIMEOUT_MS = 30_000;

const cache = new Map<string, QuoteCampaignKpiCells>();

export function quoteKpiCacheKey(leadId: number, view: QuoteSheetView, briefText: string): string {
  const included = view.groups.flatMap((group) =>
    group.rows
      .filter((row) => row.included)
      .map((row) => [group.service_code, group.service_name, row.task, row.qty, row.amount_vnd]),
  );
  const raw = JSON.stringify({
    leadId,
    included,
    briefText,
    vat: view.vat_percent,
    promo: view.promo_percent,
    total: view.grand_total_vnd,
  });
  return createHash('sha256').update(raw).digest('hex');
}

export function getCachedQuoteKpis(key: string): QuoteCampaignKpiCells | null {
  return cache.get(key) ?? null;
}

export function setCachedQuoteKpis(key: string, value: QuoteCampaignKpiCells): void {
  if (cache.size > 200) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, value);
}

export const QUOTE_KPI_SYSTEM_PROMPT = [
  'Bạn là planner media của PTT Ads. Trả về đúng một JSON, không markdown.',
  'Ước lượng KPI thực tế, thận trọng, bám brief (kênh khách muốn chạy, ngân sách, TA, thời gian truyền thông, cách chốt) và các hạng mục báo giá đã chọn.',
  'Chỉ đưa KPI cho kênh khách thực sự chạy hoặc dịch vụ đã tick liên quan; không bịa kênh.',
  'Schema:',
  '{"goal": string, "ta": string, "comms_period": string, "like_page": number|null,',
  '"impression": number|null, "reach": number|null, "click": number|null, "ctr": number|null,',
  '"lead": number|null, "channels": [{"name": string, "like_page": number|null, "impression": number|null,',
  '"reach": number|null, "click": number|null, "ctr": number|null, "lead": number|null}]}',
  'ctr là tỷ lệ 0–1 (ví dụ 0.015). Số nguyên cho các chỉ số còn lại. Không có dữ liệu thì để null hoặc bỏ khóa.',
].join(' ');

export function buildQuoteKpiUserPrompt(input: {
  leadLabel: string;
  briefText: string;
  budgetLabel?: string;
  timelineLabel?: string;
  callNotes?: string;
  view: QuoteSheetView;
}): string {
  const lines: string[] = [];
  lines.push(`Khách hàng: ${input.leadLabel || '—'}`);
  if (input.briefText.trim()) {
    lines.push('Brief / Discovery:');
    lines.push(input.briefText.trim());
  }
  if (input.budgetLabel) lines.push(`Ngân sách: ${input.budgetLabel}`);
  if (input.timelineLabel) lines.push(`Thời gian: ${input.timelineLabel}`);
  if (input.callNotes) lines.push(`Ghi chú cuộc gọi: ${input.callNotes}`);
  lines.push(`Tổng báo giá (sau VAT/KM): ${input.view.grand_total_vnd} VND`);
  lines.push('Hạng mục đã chọn:');
  let any = false;
  for (const group of input.view.groups) {
    const rows = group.rows.filter((row) => row.included);
    if (!rows.length) continue;
    any = true;
    lines.push(`- ${group.service_name}${group.phase_name ? ` · ${group.phase_name}` : ''}:`);
    for (const row of rows) {
      lines.push(`  + ${row.task}${row.subtask ? ` — ${row.subtask}` : ''} | SL ${row.qty} ${row.unit} | ${row.amount_vnd} VND`);
    }
  }
  if (!any) lines.push('(chưa có hạng mục)');
  lines.push('Hãy ước lượng Estimated KPIs phù hợp.');
  return lines.join('\n');
}

function num(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/%/g, '').replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

function text(raw: unknown): string {
  return String(raw ?? '').trim();
}

export function parseQuoteKpiAiJson(raw: Record<string, unknown> | null | undefined): QuoteCampaignKpiCells | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const src = rec.targets && typeof rec.targets === 'object' ? (rec.targets as Record<string, unknown>) : rec;
  const channelsRaw = src.channels ?? rec.channels;
  const channels: NonNullable<QuoteCampaignKpiCells['channels']> = [];
  if (Array.isArray(channelsRaw)) {
    for (const row of channelsRaw) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      const name = text(item.name ?? item.channel ?? item.kenh);
      if (!name) continue;
      channels.push({
        name,
        like_page: num(item.like_page),
        impression: num(item.impression),
        reach: num(item.reach),
        click: num(item.click),
        ctr: num(item.ctr),
        lead: num(item.lead),
      });
    }
  }
  const out: QuoteCampaignKpiCells = {
    goal: text(src.goal ?? rec.goal) || undefined,
    ta: text(src.ta ?? rec.ta ?? src.target_audience ?? rec.target_audience) || undefined,
    comms_period: text(src.comms_period ?? rec.comms_period ?? src.thoi_gian_truyen_thong) || undefined,
    like_page: num(src.like_page ?? rec.like_page),
    impression: num(src.impression ?? rec.impression),
    reach: num(src.reach ?? rec.reach),
    click: num(src.click ?? rec.click),
    ctr: num(src.ctr ?? rec.ctr),
    lead: num(src.lead ?? rec.lead),
    channels: channels.length ? channels : undefined,
  };
  const has =
    Boolean(out.goal) ||
    Boolean(out.ta) ||
    Boolean(out.comms_period) ||
    out.like_page != null ||
    out.impression != null ||
    out.reach != null ||
    out.click != null ||
    out.ctr != null ||
    out.lead != null ||
    Boolean(out.channels?.length);
  return has ? out : null;
}
