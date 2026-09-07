import { CpLedgerService } from './cp-ledger.service';
import { CpRendersService } from './cp-renders.service';
import { CpRenderWorker } from './cp-render.worker';

class BlockedDraftQuery {
  transaction<T>(work: (tx: BlockedDraftQuery) => Promise<T>) {
    return work(this);
  }

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

class CrossDraftKeyQuery {
  draftLoaded = false;

  transaction<T>(work: (tx: CrossDraftKeyQuery) => Promise<T>) {
    return work(this);
  }

  async query(sql: string) {
    if (sql.includes('FROM crm_cp_video_drafts')) {
      this.draftLoaded = true;
      return {
        rows: [{
          id: '99999999-9999-4999-8999-999999999999',
          project_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          agency_client_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          config_json: { estimated_credits: 3 },
          asset_state: 'ready',
          rights_expired: false,
          moderation_blocked: false,
          qc_status: null,
          asset_versions: [],
          kit_version: null,
        }],
      };
    }
    if (sql.includes('FROM crm_cp_render_jobs')) {
      if (sql.includes('j.draft_id = $2')) return { rows: [] };
      return {
        rows: [{
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          draft_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          idempotency_key: 'shared-key',
          estimate: 9,
        }],
      };
    }
    if (sql.includes('INSERT INTO crm_cp_render_jobs')) return { rows: [] };
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

  it('does not return a matching key from another draft', async () => {
    const db = new CrossDraftKeyQuery();
    const ledger = new CpLedgerService(db);
    const worker = { process: jest.fn() } as unknown as CpRenderWorker;
    const renders = new CpRendersService(db, ledger, worker);

    await expect(
      renders.submit('99999999-9999-4999-8999-999999999999', 'shared-key'),
    ).rejects.toMatchObject({
      response: { error: 'idempotency_key_conflict' },
    });
    expect(db.draftLoaded).toBe(true);
  });
});
