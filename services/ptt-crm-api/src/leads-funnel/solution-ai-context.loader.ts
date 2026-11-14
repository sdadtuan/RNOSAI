import { Pool } from 'pg';
import { parseSalesKitPdf } from '../intake/sales-kit-ingest.util';
import {
  budgetLabel,
  readDiscoveryBriefFromAnswers,
  timelineLabel,
  type SalesDiscoveryBrief,
} from '../intake/sales-discovery.util';

export type SolutionAiServiceLine = {
  slug: string;
  name: string;
  scopes: Array<{ id: number; name: string }>;
};

export type SolutionAiAttachmentText = {
  name: string;
  text: string;
  error?: string;
};

export type SolutionAiContext = {
  companyName: string;
  discovery: SalesDiscoveryBrief | null;
  discoveryText: string;
  serviceLines: SolutionAiServiceLine[];
  serviceLinesText: string;
  budgetLabel: string;
  timelineLabel: string;
  callNotes: string;
  attachments: SolutionAiAttachmentText[];
  attachmentText: string;
};

export async function loadSolutionAiContext(
  databaseUrl: string,
  leadId: number,
  plan?: { id?: number; strategy_framework?: unknown; strategy_framework_json?: unknown },
): Promise<SolutionAiContext> {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 1_000,
    connectionTimeoutMillis: 4_000,
  });
  try {
    const session = await loadLatestSession(pool, leadId);
    const discovery = readDiscoveryBriefFromAnswers(session?.answers_json) ?? null;
    const services = Array.isArray(discovery?.services) ? discovery.services : [];
    const serviceLines = await resolveServiceLines(pool, services);
    const attachments = await extractSolutionAttachmentText(planFiles(plan));
    const companyName = String(discovery?.company_name || session?.company_name || '').trim();
    const budget = budgetLabel(String(discovery?.budget_band ?? ''));
    const timeline = timelineLabel(String(discovery?.timeline_band ?? ''));
    const callNotes = String(discovery?.call_notes ?? '').trim();
    return {
      companyName,
      discovery,
      discoveryText: formatDiscovery(discovery, session),
      serviceLines,
      serviceLinesText: formatServiceLines(serviceLines, services),
      budgetLabel: budget || String(discovery?.budget_band ?? ''),
      timelineLabel: timeline || String(discovery?.timeline_band ?? ''),
      callNotes,
      attachments,
      attachmentText: formatAttachments(attachments),
    };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function extractSolutionAttachmentText(
  files: Array<{ name?: string; data_url?: string; mime?: string }>,
  maxChars = 12_000,
): Promise<SolutionAiAttachmentText[]> {
  const out: SolutionAiAttachmentText[] = [];
  for (const file of files) {
    const name = String(file.name ?? 'file').trim() || 'file';
    const dataUrl = String(file.data_url ?? '');
    const mime = String(file.mime ?? '');
    const isPdf =
      /pdf/i.test(mime) || /\.pdf$/i.test(name) || /^data:application\/pdf/i.test(dataUrl);
    if (!isPdf) {
      out.push({ name, text: '', error: 'not_pdf' });
      continue;
    }
    const buf = dataUrlToBuffer(dataUrl);
    if (!buf) {
      out.push({ name, text: '', error: 'unreadable' });
      continue;
    }
    const parsed = await parseSalesKitPdf(buf);
    const text = (parsed.chunks ?? [])
      .map((chunk) => [chunk.title, chunk.body].filter(Boolean).join('\n'))
      .join('\n')
      .trim()
      .slice(0, maxChars);
    out.push({
      name,
      text,
      error: parsed.error || (!text ? 'empty' : undefined),
    });
  }
  return out;
}

async function loadLatestSession(
  pool: Pool,
  leadId: number,
): Promise<{ answers_json: unknown; company_name?: string; contact_name?: string; decision?: string; bant_total?: unknown } | null> {
  const result = await pool.query(
    `SELECT answers_json, company_name, contact_name, decision, bant_total
       FROM crm_lead_intake_sessions
      WHERE lead_id = $1 AND status = 'completed'
      ORDER BY completed_at DESC NULLS LAST, id DESC
      LIMIT 1`,
    [leadId],
  );
  return (result.rows[0] as typeof result.rows[0] | undefined) ?? null;
}

async function resolveServiceLines(pool: Pool, services: string[]): Promise<SolutionAiServiceLine[]> {
  const slugs: string[] = [];
  const scopeIds: number[] = [];
  for (const raw of services) {
    const token = String(raw ?? '').trim();
    if (!token) continue;
    const scopeMatch = /^scope:(\d+)$/i.exec(token);
    if (scopeMatch) {
      scopeIds.push(Number(scopeMatch[1]));
      continue;
    }
    slugs.push(token);
  }
  const names = new Map<string, string>();
  if (slugs.length) {
    const result = await pool.query(
      `SELECT slug, name FROM crm_catalog_services
        WHERE slug = ANY($1::text[])`,
      [slugs],
    );
    for (const row of result.rows as Array<{ slug: string; name: string }>) {
      names.set(String(row.slug), String(row.name ?? row.slug));
    }
  }
  const scopesBySlug = new Map<string, Array<{ id: number; name: string }>>();
  if (scopeIds.length) {
    const result = await pool.query(
      `SELECT r.id AS scope_id,
              r.feature,
              s.slug AS service_slug,
              s.name AS service_name
         FROM crm_service_scope_rows r
         JOIN crm_services cs
           ON cs.id = r.service_id
         JOIN crm_catalog_services s
           ON lower(trim(cs.name)) = lower(trim(s.name))
        WHERE r.id = ANY($1::int[])`,
      [scopeIds],
    );
    for (const row of result.rows as Array<{
      scope_id: number | string;
      feature: string;
      service_slug: string;
      service_name: string;
    }>) {
      const slug = String(row.service_slug);
      if (!names.has(slug)) names.set(slug, String(row.service_name ?? slug));
      const list = scopesBySlug.get(slug) ?? [];
      list.push({ id: Number(row.scope_id), name: String(row.feature ?? '').trim() || `scope:${row.scope_id}` });
      scopesBySlug.set(slug, list);
      if (!slugs.includes(slug)) slugs.push(slug);
    }
  }
  return slugs.map((slug) => ({
    slug,
    name: names.get(slug) || slug,
    scopes: scopesBySlug.get(slug) ?? [],
  }));
}

function planFiles(
  plan?: { strategy_framework?: unknown; strategy_framework_json?: unknown },
): Array<{ name?: string; data_url?: string; mime?: string }> {
  const raw = plan?.strategy_framework ?? plan?.strategy_framework_json;
  const rec =
    typeof raw === 'string'
      ? (safeJson(raw) as Record<string, unknown> | null)
      : raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null;
  if (!rec) return [];
  const files = rec.mkt_files;
  const list = typeof files === 'string' ? safeJson(files) : files;
  return Array.isArray(list) ? (list as Array<{ name?: string; data_url?: string; mime?: string }>) : [];
}

function formatDiscovery(
  brief: SalesDiscoveryBrief | null,
  session: { contact_name?: string; decision?: string; bant_total?: unknown } | null,
): string {
  if (!brief) return session ? `Liên hệ: ${session.contact_name ?? ''}`.trim() : '';
  const lines = [
    `Công ty: ${brief.company_name || ''}`,
    `Ngành: ${brief.industry || ''}`,
    `Sản phẩm chủ lực: ${brief.flagship_product || ''}`,
    `Liên hệ: ${brief.contact_name || session?.contact_name || ''}`,
    `Vấn đề: ${brief.biggest_problem || ''}`,
    `Mục tiêu MKT: ${brief.marketing_goal || ''}`,
    `KH mục tiêu: ${brief.target_customers || ''}`,
    `Khu vực: ${brief.region || ''}`,
    `Kênh: ${(brief.channels ?? []).join(', ')}`,
    `Kết quả hiện tại: ${brief.current_results || ''}`,
    `Khó khăn: ${brief.difficulties || ''}`,
    session?.decision ? `Quyết định: ${session.decision}` : '',
    session?.bant_total != null ? `BANT: ${session.bant_total}` : '',
  ];
  return lines.filter((line) => line && !line.endsWith(': ')).join('\n');
}

function formatServiceLines(lines: SolutionAiServiceLine[], raw: string[]): string {
  if (!lines.length) return raw.join(', ');
  return lines
    .map((line) => {
      const scopes = line.scopes.map((scope) => scope.name).join('; ');
      return scopes ? `${line.name} — ${scopes}` : line.name;
    })
    .join('\n');
}

function formatAttachments(rows: SolutionAiAttachmentText[]): string {
  if (!rows.length) return '';
  return rows
    .map((row) => {
      if (row.text) return `### ${row.name}\n${row.text}`;
      return `### ${row.name}\n(không trích được text${row.error ? `: ${row.error}` : ''})`;
    })
    .join('\n\n');
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = /^data:[^;]+;base64,([a-zA-Z0-9+/=\s]+)$/.exec(String(dataUrl ?? '').trim());
  if (!match) return null;
  try {
    return Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
  } catch {
    return null;
  }
}

function safeJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
