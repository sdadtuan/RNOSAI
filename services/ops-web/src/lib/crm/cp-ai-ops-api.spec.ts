import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CpApiError } from './cp-api';
import {
  confirmMagnificJob,
  draftMagnificJob,
  extractJobAssetId,
  formatMagnificConfirmError,
  formatMagnificEstimate,
  getMagnificJob,
  getProviderHealth,
  magnificCompletionNotice,
  submitMagnificJob,
} from './cp-ai-ops-api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Magnific jobs API helpers', () => {
  it('drafts, confirms, submits, and gets a job on /api/crm/cp/jobs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method ?? 'GET');
      if (url.endsWith('/jobs/draft') && method === 'POST') {
        return jsonResponse({
          job_id: 'job-1',
          status: 'pending_confirm',
          estimate: { credits: 12, duration_sec: 30 },
          requires_confirmation: true,
        });
      }
      if (url.endsWith('/jobs/job-1/confirm') && method === 'POST') {
        return jsonResponse({ id: 'job-1', state: 'pending_confirm' });
      }
      if (url.endsWith('/jobs/job-1/submit') && method === 'POST') {
        return jsonResponse({ job_id: 'job-1', status: 'queued' });
      }
      if (url.endsWith('/jobs/job-1') && method === 'GET') {
        return jsonResponse({
          id: 'job-1',
          state: 'qc',
          asset_id: 'asset-9',
          stage_log_json: { asset_id: 'asset-9' },
        });
      }
      return jsonResponse({ error: 'unexpected' }, 500);
    });

    const drafted = await draftMagnificJob('token', {
      project_id: 'proj-1',
      provider: 'magnific_rest',
      inputs: { prompt: 'đèn lồng', capability: 'images_generate' },
      idempotency_key: 'idem-1',
    });
    expect(drafted).toEqual({
      job_id: 'job-1',
      status: 'pending_confirm',
      estimate: { credits: 12, duration_sec: 30 },
      requires_confirmation: true,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/api\/crm\/cp\/jobs\/draft$/);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        project_id: 'proj-1',
        provider: 'magnific_rest',
        inputs: { prompt: 'đèn lồng', capability: 'images_generate' },
        idempotency_key: 'idem-1',
      }),
    }));

    await confirmMagnificJob('token', 'job-1', true);
    expect(fetchMock.mock.calls[1]?.[0]).toMatch(/\/api\/crm\/cp\/jobs\/job-1\/confirm$/);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    }));

    await submitMagnificJob('token', 'job-1');
    expect(fetchMock.mock.calls[2]?.[0]).toMatch(/\/api\/crm\/cp\/jobs\/job-1\/submit$/);
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ method: 'POST' }));

    const job = await getMagnificJob('token', 'job-1');
    expect(fetchMock.mock.calls[3]?.[0]).toMatch(/\/api\/crm\/cp\/jobs\/job-1$/);
    expect(extractJobAssetId(job)).toBe('asset-9');

    fetchMock.mockRestore();
  });

  it('sends confirm: false so the API can return human_confirm_required', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: 'human_confirm_required' }, 400),
    );

    await expect(confirmMagnificJob('token', 'job-1', false)).rejects.toMatchObject({
      message: 'human_confirm_required',
      status: 400,
    });
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      body: JSON.stringify({ confirm: false }),
    }));

    fetchMock.mockRestore();
  });
});

describe('Magnific display helpers', () => {
  it('reads asset_id from the job field or stage_log_json', () => {
    expect(extractJobAssetId({ asset_id: 'a1' })).toBe('a1');
    expect(extractJobAssetId({ stage_log_json: { asset_id: 'a2' } })).toBe('a2');
    expect(extractJobAssetId({ stage_log_json: '{}' })).toBe(null);
    expect(extractJobAssetId({})).toBe(null);
  });

  it('formats estimate with empty — and never invents zero', () => {
    expect(formatMagnificEstimate({ credits: 12, duration_sec: 30 })).toBe('12 credit · 30 giây');
    expect(formatMagnificEstimate({ credits: null, duration_sec: null })).toBe('— credit · — giây');
  });

  it('never notices Thành công when ingested=0 or there is no asset', () => {
    expect(magnificCompletionNotice({ ingested: 0 })).not.toMatch(/Thành công/i);
    expect(magnificCompletionNotice({ ingested: 0, asset_id: 'a1' })).not.toMatch(/Thành công/i);
    expect(magnificCompletionNotice({})).not.toMatch(/Thành công/i);
    expect(magnificCompletionNotice({ asset_id: 'a1', ingested: 1 })).toContain('a1');
    expect(magnificCompletionNotice({ stage_log_json: { asset_id: 'a2' } })).toContain('a2');
  });

  it('shows Vietnamese copy with the 400 human_confirm_required code', () => {
    const copy = formatMagnificConfirmError(
      new CpApiError('human_confirm_required', 400),
    );
    expect(copy).toMatch(/xác nhận/i);
    expect(copy).toContain('human_confirm_required');
  });
});

describe('Magnific API source contract', () => {
  it('does not embed secrets, tokens, API keys, or Magnific host URLs', () => {
    const source = readFileSync(new URL('./cp-ai-ops-api.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/magnific\.com/i);
    expect(source).not.toMatch(/MAGNIFIC_REST_BASE|api[_-]?key|secret|sk-|Bearer /i);
  });
});

describe('Comfy provider health API', () => {
  it('reads GET /api/crm/cp/provider-health and never invents a host', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ comfy: { ok: false, reason: 'gpu_building' } }),
    );

    const health = await getProviderHealth('token');
    expect(health).toEqual({ comfy: { ok: false, reason: 'gpu_building' } });
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/api\/crm\/cp\/provider-health$/);
    expect(JSON.stringify(health)).not.toMatch(/8188|COMFYUI_GATEWAY|localhost|127\.0\.0\.1/i);

    fetchMock.mockRestore();
  });

  it('does not embed :8188 or the Comfy gateway env in the health client', () => {
    const source = readFileSync(new URL('./cp-ai-ops-api.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/8188|COMFYUI_GATEWAY/i);
  });
});
