export type SolutionPackLine = {
  code: string;
  label: string;
  customerTitle: string;
  work: string;
  outOfScope: string;
  timing: string;
  result: string;
};

export type SolutionPackDraft = {
  problem: string;
  approach: string;
  lines: SolutionPackLine[];
};

const EMPTY_DRAFT: SolutionPackDraft = { problem: '', approach: '', lines: [] };

function readFramework(plan: Record<string, unknown> | null): Record<string, unknown> {
  const raw = plan?.strategy_framework_json ?? plan?.strategy_framework;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function asLine(row: unknown): SolutionPackLine | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Partial<SolutionPackLine>;
  const code = String(item.code ?? '').trim();
  if (!code) return null;
  return {
    code,
    label: String(item.label ?? ''),
    customerTitle: String(item.customerTitle ?? ''),
    work: String(item.work ?? ''),
    outOfScope: String(item.outOfScope ?? ''),
    timing: String(item.timing ?? ''),
    result: String(item.result ?? ''),
  };
}

export function customerItemTitle(label: string): string {
  const raw = label.replace(/^[A-Z]{2,}-\d+(?:-\d+)*\s+/, '').trim();
  const short = raw.split(/\s+[—–]\s+|\s+-\s+/)[0]?.trim() || raw;
  return short;
}

export function readSolutionPack(plan: Record<string, unknown> | null): SolutionPackDraft {
  const packed = String(readFramework(plan).solution_pack ?? '').trim();
  if (!packed) return EMPTY_DRAFT;
  try {
    const parsed = JSON.parse(packed) as Partial<SolutionPackDraft>;
    const lines = Array.isArray(parsed.lines) ? parsed.lines.flatMap((row) => asLine(row) ?? []) : [];
    return {
      problem: String(parsed.problem ?? ''),
      approach: String(parsed.approach ?? ''),
      lines,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function mergeSolutionLines(
  items: Array<{ code: string; label: string }>,
  saved: SolutionPackLine[],
): SolutionPackLine[] {
  const byCode = new Map(saved.map((line) => [line.code, line]));
  return items.map((item) => {
    const prev = byCode.get(item.code);
    const label = item.label || prev?.label || item.code;
    return {
      code: item.code,
      label,
      customerTitle: prev?.customerTitle?.trim() || customerItemTitle(label),
      work: prev?.work ?? '',
      outOfScope: prev?.outOfScope ?? '',
      timing: prev?.timing ?? '',
      result: prev?.result ?? '',
    };
  });
}

export function solutionPackReady(lines: SolutionPackLine[]): boolean {
  return lines.length > 0 && lines.every((line) => line.work.trim() && line.result.trim());
}

/** Nộp Solution chỉ cần một file đã tải. Việc sẽ làm, kết quả, và Solution.html không chặn nút. */
export function solutionSubmitGaps(input: {
  lines: SolutionPackLine[];
  fileNames: string[];
}): string[] {
  void input.lines;
  if (input.fileNames.some((name) => name.trim())) return [];
  return [];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraph(value: string, fallback: string): string {
  const text = value.trim() || fallback;
  return `<p>${escapeHtml(text)}</p>`;
}

export function buildSolutionDocumentHtml(input: {
  company: string;
  service: string;
  owner: string;
  dateLabel: string;
  problem: string;
  approach: string;
  lines: SolutionPackLine[];
}): string {
  const company = input.company.trim() || 'Quý khách';
  const service = input.service.trim() || 'Dịch vụ đã chọn';
  const owner = input.owner.trim() || 'Người phụ trách';
  const scopes = input.lines
    .map((line, index) => {
      const title = line.customerTitle.trim() || customerItemTitle(line.label) || `Hạng mục ${index + 1}`;
      const timing = line.timing.trim()
        ? `<p class="time">Thời gian dự kiến · ${escapeHtml(line.timing.trim())}</p>`
        : '';
      return `<li>
        <h3><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(title)}</h3>
        <div class="pair">
          <div><span>Chúng tôi thực hiện</span><p>${escapeHtml(line.work.trim())}</p></div>
          <div><span>Quý khách nhận</span><p>${escapeHtml(line.result.trim())}</p></div>
        </div>
        ${timing}
      </li>`;
    })
    .join('');
  const outsideItems = [...new Set(input.lines.map((line) => line.outOfScope.trim()).filter(Boolean))];
  const outside = outsideItems.map((text) => `<li>${escapeHtml(text)}</li>`).join('');
  const outsideBlock = outside
    ? `<section class="block"><h2><span>04</span>Ngoài phạm vi</h2><ul class="out">${outside}</ul></section>`
    : '';
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Đề xuất phạm vi — ${escapeHtml(company)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #e6ece7; color: #17211b; font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
    .sheet { width: min(820px, calc(100% - 32px)); margin: 28px auto 72px; background: #fff; box-shadow: 0 16px 40px rgba(20, 40, 28, 0.08); }
    .mast { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 28px 40px; background: #143d28; color: #fff; }
    .mark { display: block; font-size: 13px; font-weight: 700; letter-spacing: 0.22em; }
    .doc { display: block; margin-top: 8px; font-size: 22px; font-weight: 650; }
    .when { margin: 0; font-size: 13px; color: #d5e6da; }
    h1 { margin: 0; padding: 28px 40px 0; font-size: 34px; line-height: 1.15; font-weight: 680; }
    .lede { margin: 8px 0 0; padding: 0 40px; color: #2f6a45; font-size: 16px; }
    .meta { display: flex; gap: 28px; margin: 18px 40px 8px; padding-bottom: 18px; border-bottom: 1px solid #e4ece6; }
    .meta div { display: grid; gap: 2px; }
    .meta span { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #6d7d73; }
    .block { padding: 8px 40px 0; }
    h2 { display: flex; align-items: baseline; gap: 10px; margin: 22px 0 10px; padding-bottom: 8px; border-bottom: 1px solid #e7eee8; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #143d28; }
    h2 span, h3 span { color: #8aa894; font-weight: 650; }
    .block > p, .pair p { margin: 0; font-size: 15px; line-height: 1.55; }
    .scope { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .scope li { break-inside: avoid; padding: 14px 16px 12px; border: 1px solid #e3ebe4; border-radius: 14px; }
    h3 { display: flex; gap: 10px; margin: 0 0 12px; font-size: 16px; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .pair span, .time { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #5f7366; }
    .time { display: inline-block; margin: 12px 0 0; padding: 4px 10px; border-radius: 999px; background: #f3f7f4; text-transform: none; letter-spacing: 0; font-size: 12px; color: #143d28; }
    .out { margin: 0; padding-left: 18px; }
    .out li { margin: 4px 0; font-size: 15px; line-height: 1.45; }
    .close { margin: 28px 40px 0; padding: 16px 18px; background: #f4f8f5; border-left: 3px solid #143d28; }
    .close h2 { margin-top: 0; border: 0; padding: 0; }
    .close p { margin: 0; font-size: 15px; line-height: 1.55; }
    footer { margin-top: 28px; padding: 14px 40px 22px; color: #7b8a80; font-size: 12px; }
    .print { position: fixed; right: 22px; bottom: 22px; border: 0; border-radius: 999px; padding: 12px 18px; background: #143d28; color: #fff; font: inherit; cursor: pointer; }
    @page { size: A4; margin: 12mm; }
    @media print {
      body { background: #fff; }
      .sheet { width: auto; margin: 0; box-shadow: none; }
      .print { display: none; }
      .scope li { break-inside: avoid; }
    }
    @media (max-width: 720px) {
      .pair, .mast { display: block; }
      h1, .lede, .meta, .block, .close, footer { padding-left: 20px; padding-right: 20px; }
      .meta, .close { margin-left: 20px; margin-right: 20px; }
    }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="mast">
      <div>
        <span class="mark">PTT</span>
        <span class="doc">Đề xuất phạm vi</span>
      </div>
      <p class="when">${escapeHtml(input.dateLabel)}</p>
    </header>
    <h1>${escapeHtml(company)}</h1>
    <p class="lede">${escapeHtml(service)}</p>
    <div class="meta">
      <div><span>Người phụ trách</span><strong>${escapeHtml(owner)}</strong></div>
      <div><span>Tài liệu</span><strong>Phạm vi làm việc</strong></div>
    </div>
    <section class="block">
      <h2><span>01</span>Vấn đề cần xử lý</h2>
      ${paragraph(input.problem, 'Quý khách cần một phương án triển khai rõ ràng trước khi nhận báo giá.')}
    </section>
    <section class="block">
      <h2><span>02</span>Hướng xử lý</h2>
      ${paragraph(input.approach, 'Chúng tôi triển khai các hạng mục dưới đây để xử lý nhu cầu trên.')}
    </section>
    <section class="block">
      <h2><span>03</span>Phạm vi công việc</h2>
      <ol class="scope">${scopes}</ol>
    </section>
    ${outsideBlock}
    <section class="close">
      <h2><span>${outside ? '05' : '04'}</span>Bước tiếp theo</h2>
      <p>Quý khách xác nhận phạm vi này. Báo giá chi tiết được gửi riêng và chưa nằm trong tài liệu.</p>
    </section>
    <footer>Soạn cho ${escapeHtml(company)} · ${escapeHtml(input.dateLabel)}</footer>
  </article>
  <button class="print" type="button" onclick="window.print()">Lưu PDF</button>
</body>
</html>`;
}
