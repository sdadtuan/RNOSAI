import { CpLedgerService } from './cp-ledger.service';
import { CpRendersService } from './cp-renders.service';
import { CpRenderWorker } from './cp-render.worker';

class BlockedDraftQuery {
  async query(sql: string) {
    if (sql.includes('FROM crm_cp_render_jobs')) return { rows: [] };
    if (sql.includes('FROM crm_cp_video_drafts')) {
      return {
        rows: [{
          id: '66666666-6666-4666-8666-666666666666',
          project_id: '77777777-7777-4777-8777-777777777777',
          agency_client_id: '88888888-8888-4888-8888-888888888888',
          config_json: {},
          asset_state: 'processing',
          rights_expired: false,
          moderation_blocked: false,
          qc_status: null,
          asset_versions: [],
          kit_version: null,
        }],
      };
    }
    return { rows: [] };
  }
}

describe('CpRendersService', () => {
  it('block reasons from render-block util abort submit', async () => {
    const db = new BlockedDraftQuery();
    const ledger = new CpLedgerService(db);
    const worker = { process: jest.fn() } as unknown as CpRenderWorker;
    const renders = new CpRendersService(db, ledger, worker);

    await expect(
      renders.submit('66666666-6666-4666-8666-666666666666', 'k'),
    ).rejects.toMatchObject({
      response: { error: 'render_blocked' },
    });
  });
});
