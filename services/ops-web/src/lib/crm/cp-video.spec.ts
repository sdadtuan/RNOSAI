import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCpRender,
  formatCpApiError,
  getCpVideoVersion,
  listCpRenders,
  listCpScenes,
  parseCpScriptEditor,
  patchCpTimeline,
  patchCpVideo,
  putCpScenes,
  regenerateCpScene,
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

  it('loads a video version from the version endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'version-1', draft_id: 'draft-1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getCpVideoVersion('token', 'version-1', 'team');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/crm/cp/videos/versions/version-1?scope=team'),
      expect.any(Object),
    );
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('/api/crm/cp/videos/version-1?');
  });

  it('lists and replaces scenes on the draft scenes endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ idx: 0, title: 'Hook' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await listCpScenes('token', 'draft-1', 'team');
    await putCpScenes('token', 'draft-1', {
      scenes: [{ idx: 0, title: 'Hook', t_start: 0, t_end: 3, locked: false }],
    }, 'team');

    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/videos/draft-1/scenes?scope=team'),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/videos/draft-1/scenes?scope=team'),
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('patches timeline through the revision endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ revision: 2, scenes: [] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await patchCpTimeline('token', 'draft-1', {
      scenes: [{ idx: 0, t_start: 1, t_end: 4 }],
    }, 'all');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/crm/cp/videos/draft-1/timeline?scope=all'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('regenerates a scene through the scene regenerate endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ idx: 0, overlay: 'LOCKED OVERLAY', locked: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await regenerateCpScene('token', 'draft-1', 0, 'me');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/crm/cp/videos/draft-1/scenes/0/regenerate?scope=me'),
      expect.objectContaining({ method: 'POST' }),
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

describe('parseCpScriptEditor', () => {
  it('keeps an object script as the same JSON shape after an untouched round trip', () => {
    const script = { scenes: [{ voiceover: 'Xin chào', duration: 3 }] };
    const editorText = JSON.stringify(script, null, 2);

    expect(parseCpScriptEditor(editorText)).toEqual(script);
  });

  it('keeps plain script text as a JSON string instead of wrapping it', () => {
    expect(parseCpScriptEditor('Xin chào')).toBe('Xin chào');
  });
});
