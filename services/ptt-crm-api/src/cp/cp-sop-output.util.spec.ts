import {
  parseVdProjectId,
  resolveConfiguredSopOutputUri,
  resolveLinkedVdProjectId,
  resolveSopMasterOutputUri,
  resolveSopOutputUri,
} from './cp-sop-output.util';

describe('cp-sop-output.util', () => {
  it('parses positive vd project ids', () => {
    expect(parseVdProjectId('12')).toBe(12);
    expect(parseVdProjectId(0)).toBeNull();
    expect(parseVdProjectId('abc')).toBeNull();
  });

  it('reads configured output uri from draft config', () => {
    expect(resolveConfiguredSopOutputUri({
      sop_output_uri: 'file:///tmp/master.mp4',
    })).toBe('file:///tmp/master.mp4');
  });

  it('resolves vd project id from deliverable link', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ vd_project_id: '42' }],
      }),
    };
    const id = await resolveLinkedVdProjectId(
      db,
      '11111111-1111-4111-8111-111111111111',
      {},
    );
    expect(id).toBe(42);
  });

  it('maps master asset url or storage key to output uri', async () => {
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ url: 'https://cdn/master.mp4', storage_key: 'x' }] })
        .mockResolvedValueOnce({ rows: [{ url: '', storage_key: '/data/master.mp4' }] }),
    };
    await expect(resolveSopMasterOutputUri(db, 7)).resolves.toBe('https://cdn/master.mp4');
    await expect(resolveSopMasterOutputUri(db, 7)).resolves.toBe('sop://vd/7/master');
  });

  it('prefers configured output uri over vd master lookup', async () => {
    const db = {
      query: jest.fn(),
    };
    const resolved = await resolveSopOutputUri(
      db,
      '22222222-2222-4222-8222-222222222222',
      {
        vd_project_id: 9,
        output_uri: 'file:///tmp/ready.mp4',
      },
    );
    expect(resolved).toEqual({
      vdProjectId: 9,
      outputUri: 'file:///tmp/ready.mp4',
    });
    expect(db.query).not.toHaveBeenCalled();
  });
});
