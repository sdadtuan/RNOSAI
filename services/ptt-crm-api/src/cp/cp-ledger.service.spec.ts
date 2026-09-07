import { CpLedgerService } from './cp-ledger.service';
import { CpRendersService } from './cp-renders.service';
import { CpRenderWorker } from './cp-render.worker';

const draftId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const clientId = '33333333-3333-4333-8333-333333333333';

class LedgerMemory {
  rows: Array<Record<string, unknown>> = [];

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes('INSERT INTO crm_cp_credit_ledger')) {
      const key = String(params[6]);
      const existing = this.rows.find((row) => row.idempotency_key === key);
      if (existing) return { rows: [] };
      const row = {
        kind: params[1],
        amount: params[2],
        agency_client_id: params[3],
        project_id: params[4],
        job_id: params[5],
        idempotency_key: key,
      };
      this.rows.push(row);
      return { rows: [row] };
    }
    if (sql.includes('SUM(amount)')) {
      const amount = this.rows
        .filter((row) => row.kind === params[1] && row.project_id === params[2])
        .reduce((sum, row) => sum + Number(row.amount), 0);
      return { rows: [{ amount }] };
    }
    return { rows: [] };
  }
}

class RenderMemory {
  job: Record<string, unknown> | null = null;

  async query(sql: string) {
    if (sql.includes('FROM crm_cp_render_jobs') && sql.includes('idempotency_key')) {
      return { rows: this.job ? [this.job] : [] };
    }
    if (sql.includes('FROM crm_cp_video_drafts')) {
      return {
        rows: [{
          id: draftId,
          project_id: projectId,
          agency_client_id: clientId,
          config_json: { estimated_credits: 7 },
          asset_state: 'ready',
          rights_expired: false,
          moderation_blocked: false,
          qc_status: null,
          asset_versions: [],
          kit_version: null,
        }],
      };
    }
    if (sql.includes('INSERT INTO crm_cp_render_jobs')) {
      this.job = {
        id: '44444444-4444-4444-8444-444444444444',
        draft_id: draftId,
        idempotency_key: 'k9',
        state: 'queued',
        attempt: 1,
      };
      return { rows: [this.job] };
    }
    return { rows: [] };
  }
}

describe('CpLedgerService', () => {
  it('duplicate Idempotency-Key does not double reserve', async () => {
    const ledgerDb = new LedgerMemory();
    const ledger = new CpLedgerService(ledgerDb);
    const worker = { process: jest.fn().mockResolvedValue(undefined) } as unknown as CpRenderWorker;
    const renders = new CpRendersService(new RenderMemory(), ledger, worker);

    const a = await renders.submit(draftId, 'k9');
    const b = await renders.submit(draftId, 'k9');

    expect(a.job_id).toBe(b.job_id);
    expect(await ledger.sum('reserve', projectId)).toBe(a.estimate);
  });
});
