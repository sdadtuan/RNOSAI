import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCpRender,
  formatCpApiError,
  listCpRenders,
  patchCpVideo,
  type CpVideoDraftInput,
} from './cp-api';

const draft: CpVideoDraftInput = {
  name: 'Draft',
  input_mode: 'prompt',
  prompt: 'Create a launch video',
  config_json: { ratio: '9:16', duration: 30 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CP video API', () => {
  it('patches an existing draft through the scoped video endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'draft-1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await patchCpVideo('token', 'draft-1', draft, 'team');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/crm/cp/videos/draft-1?scope=team'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify(draft) }),
    );
  });

  it('uses the supplied fresh idempotency key for every render request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ job_id: 'job-1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createCpRender('token', 'draft-1', 'uuid-per-click', 'all');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/crm/cp/videos/draft-1/render?scope=all'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Idempotency-Key': 'uuid-per-click' }),
      }),
    );
  });

  it('lists render jobs from the shared scoped endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listCpRenders('token', 'me');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/crm/cp/renders?scope=me'),
      expect.any(Object),
    );
  });

  it('surfaces render_blocked reasons returned by the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'render_blocked', reasons: ['rights_expired', 'credit_blocked'] }),
        { status: 409 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await createCpRender('token', 'draft-1', 'uuid', 'me').catch((value) => value);

    expect(formatCpApiError(error)).toBe(
      'render_blocked: rights_expired, credit_blocked',
    );
  });
});
