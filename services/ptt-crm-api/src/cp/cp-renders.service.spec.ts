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

class ReplayBlockedDraftQuery {
  transaction<T>(work: (tx: ReplayBlockedDraftQuery) => Promise<T>) {
    return work(this);
  }

  async query(sql: string) {
    if (sql.includes('FROM crm_cp_video_drafts')) {
      return {
        rows: [{
          id: '12121212-1212-4212-8212-121212121212',
          project_id: '13131313-1313-4313-8313-131313131313',
          agency_client_id: '14141414-1414-4414-8414-141414141414',
          config_json: { estimated_credits: 4 },
          asset_state: 'processing',
          rights_expired: false,
          moderation_blocked: false,
          qc_status: null,
          asset_versions: [],
          kit_version: null,
        }],
      };
    }
    if (sql.includes('FROM crm_cp_render_jobs')) {
      return {
        rows: [{
          id: '15151515-1515-4515-8515-151515151515',
          draft_id: '12121212-1212-4212-8212-121212121212',
          idempotency_key: 'replay-key',
          estimate: 4,
          state: 'completed',
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

  it('replays an existing job before re-validating render gates', async () => {
    const db = new ReplayBlockedDraftQuery();
    const ledger = new CpLedgerService(db);
    const worker = { process: jest.fn() } as unknown as CpRenderWorker;
    const renders = new CpRendersService(db, ledger, worker);

    const result = await renders.submit(
      '12121212-1212-4212-8212-121212121212',
      'replay-key',
    );

    expect(result.job_id).toBe('15151515-1515-4515-8515-151515151515');
    expect(worker.process).not.toHaveBeenCalled();
  });

  it('locks the draft before allocating the next version number', async () => {
    const queries: string[] = [];
    const db = {
      async query(sql: string) {
        queries.push(sql);
        return { rows: [] };
      },
    };
    const worker = new CpRenderWorker(db);

    await worker.process(
      {
        id: '16161616-1616-4616-8616-161616161616',
        draft_id: '17171717-1717-4717-8717-171717171717',
      },
      {},
    );

    const lock = queries.findIndex(
      (sql) => sql.includes('crm_cp_video_drafts') && sql.includes('FOR UPDATE'),
    );
    const allocate = queries.findIndex((sql) =>
      sql.includes('INSERT INTO crm_cp_video_versions'));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(allocate);
  });
});
