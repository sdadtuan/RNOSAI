import { CpVideosService } from './cp-videos.service';

class ImmutableVersionQuery {
  async query(sql: string) {
    if (sql.includes('SELECT') && sql.includes('crm_cp_video_versions')) {
      return {
        rows: [{
          id: '55555555-5555-4555-8555-555555555555',
          immutable: true,
        }],
      };
    }
    return { rows: [] };
  }
}

describe('CpVideosService', () => {
  it('completed version rejects patch', async () => {
    const videos = new CpVideosService(new ImmutableVersionQuery());

    await expect(
      videos.patchVersion('55555555-5555-4555-8555-555555555555', {
        qc_status: 'passed',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
