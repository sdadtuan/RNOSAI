import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCpExperiment, createCpExperimentVariant } from './cp-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CP experiment API', () => {
  it('creates an experiment under a project', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        project_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Hook A/B',
        variants_json: [],
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createCpExperiment('token', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
      name: 'Hook A/B',
      variants_json: [],
    }, 'me');

    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/experiments'),
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ method: 'POST' }));
  });

  it('creates an extra variant version without patching a completed snapshot', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        experiment: { variants_json: [{ label: 'B' }] },
        version: { immutable: false },
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createCpExperimentVariant('token', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', {
      draft_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      label: 'B',
    });

    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/experiments/dddddddd-dddd-4ddd-8ddd-dddddddddddd/variants'),
    );
  });
});
