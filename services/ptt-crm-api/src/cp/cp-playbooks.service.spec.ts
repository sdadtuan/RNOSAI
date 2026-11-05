import { CpPlaybooksService } from './cp-playbooks.service';

describe('CpPlaybooksService', () => {
  it('lists registry playbooks', () => {
    const svc = new CpPlaybooksService({ query: jest.fn() }, {} as never);
    const result = svc.list();
    expect(result.items).toHaveLength(3);
    expect(result.items.map((row) => row.id)).toContain('bds_social_916');
  });

  it('get attaches published template id when found', async () => {
    const templateId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: templateId, name: 'bds-social-916', status: 'published', version: 1 }],
      }),
    };
    const svc = new CpPlaybooksService(db, {} as never);
    const detail = await svc.get('bds_social_916');
    expect(detail.template_id).toBe(templateId);
    expect(detail.qc_pack).toBe('bds_social');
  });

  it('run creates batch via CpBatchesService', async () => {
    const templateId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const batchId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: templateId, name: 'bds-social-916', status: 'published' }],
      }),
    };
    const batches = {
      create: jest.fn().mockResolvedValue({
        id: batchId,
        estimate_credits: 5,
        items: [{ row_no: 1 }],
      }),
    };
    const svc = new CpPlaybooksService(db, batches as never);
    const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const result = await svc.run(
      'bds_social_916',
      {
        project_id: projectId,
        rows: [{ project_name: 'The Peak', price_from: 'từ 3 tỷ', location: 'Q7', cta: 'Form', hotline: '1900' }],
      },
      { scope: 'all', staffId: 9 },
      9,
    );
    expect(result.batch_id).toBe(batchId);
    expect(batches.create).toHaveBeenCalledWith(
      expect.objectContaining({
        template_id: templateId,
        project_id: projectId,
      }),
      9,
      expect.objectContaining({ staffId: 9 }),
    );
  });

  it('run rejects when template is not published', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const svc = new CpPlaybooksService(db, {} as never);
    await expect(
      svc.run('bds_social_916', { rows: [{ project_name: 'X' }] }),
    ).rejects.toMatchObject({ status: 409, error: 'playbook_template_not_published' });
  });

  it('cloneToTemplate inserts draft copy from published template', async () => {
    const templateId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const draftId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{ id: templateId, name: 'bds-social-916', status: 'published', version: 1 }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: draftId, name: 'BĐS Social · agency copy', status: 'draft', version: 1 }],
        }),
    };
    const svc = new CpPlaybooksService(db, {} as never);
    const row = await svc.cloneToTemplate('bds_social_916', { name: 'Agency Peak copy' });
    expect(row).toMatchObject({ id: draftId, status: 'draft' });
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(String(db.query.mock.calls[1]?.[0])).toContain('INSERT INTO crm_cp_templates');
  });
});
