import { API_BASE, fetchLeadPresalesMarketingPlan, patchLeadPresalesMarketingPlan } from '@/lib/api';
import type { SolutionAttachment } from '@/lib/crm/solution-file-display';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[]; error?: string };
    const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
    return message || body.error || 'Không mở được file';
  } catch {
    return 'Không mở được file';
  }
}

export async function fetchSolutionFileBlob(token: string, leadId: number, fileId: string): Promise<Blob> {
  const res = await fetch(
    `${API_BASE}/api/v1/leads/${leadId}/presales/solution-files/${encodeURIComponent(fileId)}`,
    { headers: authHeaders(token), cache: 'no-store' },
  );
  if (!res.ok) throw new Error(await readError(res));
  return res.blob();
}

function viewable(file: SolutionAttachment): boolean {
  const mime = String(file.mime ?? '');
  return /pdf|html|image\/|text\//i.test(mime) || /\.(pdf|html?|png|jpe?g|gif|webp|txt)$/i.test(file.name);
}

export async function openOrDownloadSolutionFile(
  token: string,
  leadId: number,
  file: SolutionAttachment,
  mode: 'open' | 'download',
): Promise<void> {
  const blob = await fetchSolutionFileBlob(token, leadId, file.id);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  if (mode === 'download' || !viewable(file)) {
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function deleteSolutionStoredFile(token: string, leadId: number, fileId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/v1/leads/${leadId}/presales/solution-files/${encodeURIComponent(fileId)}`,
    { method: 'DELETE', headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function exportSolutionProposalFiles(
  token: string,
  leadId: number,
): Promise<{ files: Array<{ id: string; name: string; mime: string }>; attached: boolean; warning?: string }> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/presales/solution-proposal/export`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{ files: Array<{ id: string; name: string; mime: string }>; attached: boolean; warning?: string }>;
}

export async function saveSolutionAiSectionBodies(
  token: string,
  leadId: number,
  sections: Array<{ key: string; body: string }>,
  title?: string,
): Promise<void> {
  const current = await fetchLeadPresalesMarketingPlan(token, leadId);
  const plan = (current?.plan ?? {}) as Record<string, unknown>;
  const frameworkRaw = plan.strategy_framework ?? plan.strategy_framework_json;
  let framework: Record<string, unknown> = {};
  if (typeof frameworkRaw === 'string') {
    try {
      framework = JSON.parse(frameworkRaw) as Record<string, unknown>;
    } catch {
      framework = {};
    }
  } else if (frameworkRaw && typeof frameworkRaw === 'object' && !Array.isArray(frameworkRaw)) {
    framework = { ...(frameworkRaw as Record<string, unknown>) };
  }
  let packed: Record<string, unknown> = {};
  try {
    packed =
      typeof framework.solution_ai === 'string'
        ? (JSON.parse(framework.solution_ai) as Record<string, unknown>)
        : framework.solution_ai && typeof framework.solution_ai === 'object'
          ? { ...(framework.solution_ai as Record<string, unknown>) }
          : {};
  } catch {
    packed = {};
  }
  const previous =
    packed.sections && typeof packed.sections === 'object' && !Array.isArray(packed.sections)
      ? (packed.sections as Record<string, string>)
      : {};
  framework.solution_ai = JSON.stringify({
    ...packed,
    status: 'ready',
    title: title || packed.title,
    sections: {
      ...previous,
      ...Object.fromEntries(sections.map((row) => [row.key, row.body])),
    },
  });
  await patchLeadPresalesMarketingPlan(token, leadId, {
    strategy_framework: framework as Record<string, string>,
  });
}
