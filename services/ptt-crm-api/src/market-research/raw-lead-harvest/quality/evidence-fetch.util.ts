const MAX_BYTES = 500_000;

export type EvidenceFetchResult = {
  ok: boolean;
  text: string;
  status?: number;
  error?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchEvidenceText(
  url: string,
  opts?: { timeoutMs?: number },
): Promise<EvidenceFetchResult> {
  const rawUrl = String(url ?? '').trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    return { ok: false, text: '', error: 'invalid_url' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 8000);
  try {
    const res = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'RNOSAI-CRM-ResearchHarvest/1.0',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const sliced = buf.subarray(0, MAX_BYTES).toString('utf8');
    const text = stripHtml(sliced);
    if (!res.ok) {
      return { ok: false, text, status: res.status, error: `http_${res.status}` };
    }
    return { ok: true, text, status: res.status };
  } catch (err) {
    return {
      ok: false,
      text: '',
      error: err instanceof Error ? err.message : 'fetch_failed',
    };
  } finally {
    clearTimeout(timer);
  }
}
