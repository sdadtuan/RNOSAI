import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CP_TEMPLATE_REQUIRED_VARS,
  createCpBatch,
  createCpTemplate,
  getCpBatchErrorsCsv,
  listCpTemplates,
  runCpBatch,
  useCpTemplate,
  validateCpBatch,
} from './cp-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CP template + batch API', () => {
  it('lists and creates templates with the required variables', async () => {
    const fetchMock = vi.fn().mockImplementation(() => (
      Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    ));
    vi.stubGlobal('fetch', fetchMock);

    await listCpTemplates('token');
    await createCpTemplate('token', {
      name: 'SKU Reels',
      variables: [...CP_TEMPLATE_REQUIRED_VARS],
    });

    expect(CP_TEMPLATE_REQUIRED_VARS).toEqual([
      'project_name',
      'price_from',
      'location',
      'cta',
      'hotline',
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/templates'),
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses a published template to open a draft', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'draft-1', input_mode: 'template' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await useCpTemplate('token', 'tpl-1', { project_id: 'proj-1' }, 'team');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/crm/cp/templates/tpl-1/use?scope=team'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('validates and runs a batch then downloads errors.csv', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'batch-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ valid_count: 46, invalid_count: 2 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'batch-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('row_no,status,error\n2,invalid,missing_mapped_required\n', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await createCpBatch('token', { template_id: 'tpl-1', rows: [] }, 'me');
    await validateCpBatch('token', 'batch-1', 'me');
    await runCpBatch('token', 'batch-1', 'me');
    const csv = await getCpBatchErrorsCsv('token', 'batch-1', 'me');

    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/batches?scope=me'),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/batches/batch-1/validate?scope=me'),
    );
    expect(fetchMock.mock.calls[2]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/batches/batch-1/run?scope=me'),
    );
    expect(fetchMock.mock.calls[3]?.[0]).toEqual(
      expect.stringContaining('/api/crm/cp/batches/batch-1/errors.csv?scope=me'),
    );
    expect(csv).toContain('missing_mapped_required');
  });
});
