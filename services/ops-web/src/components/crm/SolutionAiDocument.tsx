import { useEffect, useMemo, useState } from 'react';
import {
  formatSolutionAiSectionText,
  formatSolutionAiTime,
  SOLUTION_AI_PENDING_LABEL,
} from '@/lib/crm/solution-ai-draft-display';
import { downloadSolutionAiPptxDocument } from '@/lib/crm/solution-ai-pptx';

type Section = { key: string; label: string; body: string };

type Inline = { text: string; bold?: boolean };

type Block =
  | { type: 'p'; inlines: Inline[][] }
  | { type: 'ul'; items: Inline[][] }
  | { type: 'ol'; items: Inline[][] }
  | { type: 'h'; inlines: Inline[] }
  | { type: 'table'; rows: string[][] };

export function SolutionAiDraftBody({
  title,
  badge,
  sections,
  pending = false,
  canEdit = false,
  busy = false,
  companyName,
  contactName,
  leadCode,
  createdAt,
  onSectionChange,
  onSave,
}: {
  title: string;
  badge: string;
  sections: Section[];
  pending?: boolean;
  canEdit?: boolean;
  busy?: boolean;
  companyName?: string;
  contactName?: string;
  leadCode?: string;
  createdAt?: string;
  onSectionChange?: (key: string, body: string) => void;
  onSave?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftSections, setDraftSections] = useState(sections);

  useEffect(() => {
    if (!editing) setDraftSections(sections);
  }, [sections, editing]);

  const readable = useMemo(
    () =>
      sections.map((row) => ({
        ...row,
        body: formatSolutionAiSectionText(row.body, row.key),
      })),
    [sections],
  );

  const customer = (companyName || contactName || '').trim() || 'Khách hàng';
  const when = formatSolutionAiTime(createdAt);
  const titleText = String(title ?? '').trim();
  const displayTitle =
    titleText && !/^bản nháp solution$/i.test(titleText) && !['solution', 'file solution'].includes(titleText.toLowerCase())
      ? titleText
      : `Solution - ${customer}`;
  const isPending = pending;
  const showEdit = canEdit && !isPending && editing;
  const pendingLabel = /đang chờ/i.test(badge) ? badge : SOLUTION_AI_PENDING_LABEL;
  const badgeLabel = isPending ? pendingLabel : 'Bản nháp AI';

  function changeSection(key: string, body: string) {
    setDraftSections((current) => current.map((row) => (row.key === key ? { ...row, body } : row)));
    onSectionChange?.(key, body);
  }

  function cancelEdit() {
    setDraftSections(sections);
    sections.forEach((row) => onSectionChange?.(row.key, row.body));
    setEditing(false);
  }

  function saveEdit() {
    onSave?.();
    setEditing(false);
  }

  function openPreview() {
    const html = buildSolutionHtmlDocument({
      customer,
      contactName: contactName || '',
      leadCode: leadCode || '',
      createdAt: when,
      subtitle: title,
      sections: readable,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function downloadDocument() {
    void downloadSolutionAiPptxDocument({
      customer,
      contactName: contactName || '',
      leadCode: leadCode || '',
      createdAt: when,
      subtitle: title,
      sections: readable,
    });
  }

  return (
    <article className="solution-ai-doc" data-testid="solution-desk-ai-result">
      <header className="solution-ai-doc__header solution-ai-doc__header--compact">
        <div className="solution-ai-doc__head-main">
          <div className="solution-ai-doc__title-row">
            <h3 className="solution-ai-doc__title">{displayTitle}</h3>
            <span className={`solution-ai-doc__badge${isPending ? ' solution-ai-doc__badge--pending' : ''}`}>
              {badgeLabel}
            </span>
          </div>
          {when ? <p className="solution-ai-doc__time">{when}</p> : null}
        </div>
        {!isPending ? (
          <div className="solution-ai-doc__actions">
            {canEdit && !editing ? (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                onClick={() => {
                  const next = readable.map((row) => ({ ...row, body: formatSolutionAiSectionText(row.body, row.key) }));
                  setDraftSections(next);
                  next.forEach((row) => onSectionChange?.(row.key, row.body));
                  setEditing(true);
                }}
              >
                Sửa
              </button>
            ) : null}
            {showEdit ? (
              <>
                <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={saveEdit}>
                  Lưu bản nháp
                </button>
                <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={cancelEdit}>
                  Hủy
                </button>
              </>
            ) : null}
            <button type="button" className="btn btn-sm btn-secondary" onClick={openPreview}>
              Xem
            </button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={downloadDocument}>
              Tải
            </button>
          </div>
        ) : null}
      </header>

      {isPending ? (
        <p className="solution-ai-doc__pending">Đang chờ AI viết. Bản nháp sẽ hiện ở đây khi agent trả kết quả.</p>
      ) : readable.length ? (
        <div className="solution-ai-doc__sections">
          {(showEdit ? draftSections : readable).map((section, index) => (
            <section key={section.key} className="solution-ai-doc__section">
              <div className="solution-ai-doc__heading">
                <span className="solution-ai-doc__num">{String(index + 1).padStart(2, '0')}</span>
                <h4>{section.label}</h4>
              </div>
              {showEdit && onSectionChange ? (
                <textarea
                  className="solution-ai-doc__input"
                  value={section.body}
                  rows={6}
                  disabled={busy}
                  onChange={(event) => changeSection(section.key, event.target.value)}
                />
              ) : section.body.trim() ? (
                <SolutionAiRichText text={section.body} />
              ) : (
                <p className="solution-ai-doc__empty">Chưa có nội dung.</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <p className="solution-ai-doc__pending">AI đã tạo bản nháp. AM kiểm tra nội dung trước khi nộp.</p>
      )}
    </article>
  );
}

function SolutionAiRichText({ text }: { text: string }) {
  const blocks = parseRichBlocks(text);
  return (
    <div className="solution-ai-doc__prose">
      {blocks.map((block, index) => {
        if (block.type === 'table') {
          return (
            <table key={index} className="solution-ai-doc__table">
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) =>
                      rowIndex === 0 ? <th key={cellIndex}>{cell}</th> : <td key={cellIndex}>{cell}</td>,
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        if (block.type === 'h') {
          return <h5 key={index}>{renderInlines(block.inlines)}</h5>;
        }
        if (block.type === 'ul') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlines(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlines(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={index}>
            {block.inlines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInlines(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function renderInlines(parts: Inline[]) {
  return parts.map((part, index) => (part.bold ? <strong key={index}>{part.text}</strong> : <span key={index}>{part.text}</span>));
}

function parseRichBlocks(text: string): Block[] {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  const limit = Math.min(lines.length, 400);
  for (let i = 0; i < limit; i += 1) {
    const raw = lines[i] ?? '';
    if (/^\s*\|/.test(raw)) {
      const rows: string[][] = [];
      while (i < limit && /^\s*\|/.test(lines[i] ?? '')) {
        const current = lines[i] ?? '';
        if (!/^\s*\|?\s*:?-{3,}/.test(current)) {
          rows.push(
            current
              .trim()
              .replace(/^\|/, '')
              .replace(/\|$/, '')
              .split('|')
              .map((cell) => cell.trim()),
          );
        }
        i += 1;
      }
      if (rows.length) blocks.push({ type: 'table', rows });
      i -= 1;
      continue;
    }
    const heading = raw.match(/^\s{0,3}#{1,3}\s+(.+)$/);
    const bullet = raw.match(/^\s*[-*•–]\s+(.+)$/);
    const ordered = raw.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'h', inlines: parseInlines(heading[1]) });
      continue;
    }
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ul') last.items.push(parseInlines(bullet[1]));
      else blocks.push({ type: 'ul', items: [parseInlines(bullet[1])] });
      continue;
    }
    if (ordered) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ol') last.items.push(parseInlines(ordered[2]));
      else blocks.push({ type: 'ol', items: [parseInlines(ordered[2])] });
      continue;
    }
    if (!raw.trim()) {
      continue;
    }
    const last = blocks[blocks.length - 1];
    const inlines = parseInlines(raw);
    if (last && last.type === 'p') last.inlines.push(inlines);
    else blocks.push({ type: 'p', inlines: [inlines] });
  }
  return blocks;
}

function parseInlines(text: string): Inline[] {
  const parts: Inline[] = [];
  const src = String(text ?? '');
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null = re.exec(src);
  let guard = 0;
  while (match && guard < 80) {
    guard += 1;
    if (match.index > last) parts.push({ text: src.slice(last, match.index) });
    parts.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
    match = re.exec(src);
  }
  if (last < src.length) parts.push({ text: src.slice(last) });
  return parts.length ? parts : [{ text: src }];
}

function buildSolutionHtmlDocument(input: {
  customer: string;
  contactName: string;
  leadCode: string;
  createdAt: string;
  subtitle: string;
  sections: Section[];
}): string {
  const meta = [input.customer, input.contactName !== input.customer ? input.contactName : '', input.leadCode ? `#${input.leadCode}` : '', input.createdAt]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');
  const title = (input.subtitle || '').trim();
  const subtitle =
    title && !/^bản nháp solution$/i.test(title) && !['solution', 'file solution'].includes(title.toLowerCase())
      ? `<p style="margin:6px 0 0;color:#334;font-size:14px;">${escapeHtml(title)}</p>`
      : '';
  const sections = input.sections
    .map((section, index) => {
      const num = String(index + 1).padStart(2, '0');
      return `<section style="border-top:1px solid #e6ece8;padding:16px 0;">
  <h2 style="margin:0 0 8px;font-size:16px;color:#173526;">${num}. ${escapeHtml(section.label)}</h2>
  ${richTextToHtml(section.body)}
</section>`;
    })
    .join('\n');
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Solution - ${escapeHtml(input.customer)}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1a2421; max-width: 880px; margin: 32px auto; padding: 0 24px 48px; }
    header { background: #14382f; color: #fff; margin: -8px -24px 20px; padding: 28px 24px; }
    header .kicker, header h1, header .meta, header p { color: #fff; }
    header { border-bottom: 2px solid #173526; padding-bottom: 16px; margin-bottom: 8px; }
    .kicker { letter-spacing: .08em; text-transform: uppercase; font-size: 12px; color: #5b6570; font-weight: 700; margin: 0 0 4px; }
    h1 { margin: 0; font-size: 28px; color: #173526; }
    .badge { display: inline-block; background: #e4f4ea; color: #17692f; border-radius: 999px; padding: 2px 8px; font-size: 12px; font-weight: 700; margin-left: 8px; vertical-align: middle; }
    .meta { color: #5b6570; font-size: 13px; margin-top: 8px; }
    p, li { font-size: 14.5px; line-height: 1.55; }
    ul, ol { padding-left: 1.2rem; }
  </style>
</head>
<body>
  <header>
    <p class="kicker">Tài liệu đề xuất</p>
    <h1>File Solution <span class="badge">Bản nháp AI</span></h1>
    ${subtitle}
    <p class="meta">${meta}</p>
  </header>
  ${sections}
</body>
</html>`;
}

function richTextToHtml(text: string): string {
  const blocks = parseRichBlocks(text);
  if (!blocks.length) return '<p style="color:#5b6570;">Chưa có nội dung.</p>';
  return blocks
    .map((block) => {
      if (block.type === 'table') {
        const rows = block.rows
          .map((row, rowIndex) => `<tr>${row.map((cell) => `<${rowIndex === 0 ? 'th' : 'td'} style="border:1px solid #d5e0db;padding:6px 8px;text-align:left;${rowIndex === 0 ? 'background:#14382f;color:#fff;' : ''}">${escapeHtml(cell)}</${rowIndex === 0 ? 'th' : 'td'}>`).join('')}</tr>`)
          .join('');
        return `<table style="border-collapse:collapse;width:100%;margin:8px 0 14px;font-size:12.5px;">${rows}</table>`;
      }
      if (block.type === 'h') return `<h3 style="font-size:15px;margin:10px 0 4px;">${inlinesToHtml(block.inlines)}</h3>`;
      if (block.type === 'ul') return `<ul>${block.items.map((item) => `<li>${inlinesToHtml(item)}</li>`).join('')}</ul>`;
      if (block.type === 'ol') return `<ol>${block.items.map((item) => `<li>${inlinesToHtml(item)}</li>`).join('')}</ol>`;
      return `<p>${block.inlines.map((line) => inlinesToHtml(line)).join('<br />')}</p>`;
    })
    .join('');
}

function inlinesToHtml(parts: Inline[]): string {
  return parts.map((part) => {
    const text = escapeHtml(part.text);
    return part.bold ? `<strong>${text}</strong>` : text;
  }).join('');
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


export function downloadSolutionAiHtmlDocument(input: {
  customer: string;
  contactName?: string;
  leadCode?: string;
  createdAt?: string;
  subtitle: string;
  sections: Section[];
}): void {
  const html = buildSolutionHtmlDocument({
    customer: input.customer,
    contactName: input.contactName || '',
    leadCode: input.leadCode || '',
    createdAt: input.createdAt || '',
    subtitle: input.subtitle,
    sections: input.sections,
  });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeFileName(`Solution - ${input.customer} (AI).html`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

/** Word-compatible .doc (HTML + Office namespaces, UTF-8 BOM) of the AI Solution draft. */
export function downloadSolutionAiWordDocument(input: {
  customer: string;
  contactName?: string;
  leadCode?: string;
  createdAt?: string;
  subtitle: string;
  sections: Section[];
  fileBase: string;
}): void {
  const html = buildSolutionHtmlDocument({
    customer: input.customer,
    contactName: input.contactName || '',
    leadCode: input.leadCode || '',
    createdAt: input.createdAt || '',
    subtitle: input.subtitle,
    sections: input.sections,
  }).replace(
    '<html lang="vi">',
    '<html lang="vi" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">',
  );
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(input.fileBase).replace(/\.html$/i, '')}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || 'Solution (AI).html';
}
