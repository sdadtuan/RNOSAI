import { BadRequestException } from '@nestjs/common';
import { MetaLeadSyncService } from './meta-lead-sync.service';

function pagesRepo() {
  return [
    {
      page_id: 'P1',
      active: true,
      token_ref: '',
      forms: [{ form_id: 'F1', active: true }],
    },
  ];
}

describe('MetaLeadSyncService.syncProject', () => {
  it('rejects when project has no active mapped form', async () => {
    const svc = new MetaLeadSyncService(
      { get: async () => ({ id: 'p1', code: 'ptt-hcm' }), listPages: async () => [] } as never,
      { resolvePageAccessToken: async () => 'tok' } as never,
      { prepareWebhookLeads: async () => ({ toEnqueue: [], unmatchedCount: 0 }) } as never,
      { enqueueIngestLeads: async () => ({ mode: 'queue', jobs: [] }) } as never,
    );
    await expect(svc.syncProject('p1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when page token is missing', async () => {
    const svc = new MetaLeadSyncService(
      { get: async () => ({ id: 'p1', code: 'ptt-hcm' }), listPages: async () => pagesRepo() } as never,
      { resolvePageAccessToken: async () => null } as never,
      { prepareWebhookLeads: async () => ({ toEnqueue: [], unmatchedCount: 0 }) } as never,
      { enqueueIngestLeads: async () => ({ mode: 'queue', jobs: [] }) } as never,
    );
    await expect(svc.syncProject('p1')).rejects.toMatchObject({
      response: { error: 'missing_page_token' },
    });
  });

  it('enqueues leads with phone/email and counts skips', async () => {
    const prepare = jest.fn(async (input: { leads: unknown[] }) => ({
      toEnqueue: input.leads,
      unmatchedCount: 0,
    }));
    const enqueue = jest.fn(async () => ({
      mode: 'queue',
      jobs: [{ id: 'j1', created: true }, { id: 'j2', created: false }],
    }));
    const svc = new MetaLeadSyncService(
      { get: async () => ({ id: 'p1', code: 'ptt-hcm' }), listPages: async () => pagesRepo() } as never,
      { resolvePageAccessToken: async () => 'tok' } as never,
      { prepareWebhookLeads: prepare } as never,
      { enqueueIngestLeads: enqueue } as never,
    );
    svc.graph = {
      listFormLeadIds: async () => ({ ids: ['L1', 'L2', 'L3'] }),
      fetchLead: async (id: string) => {
        if (id === 'L1') return { phone: '0901111222', email: '', full_name: 'A' };
        if (id === 'L2') return { phone: '', email: 'b@c.d', full_name: 'B' };
        return { phone: '', email: '', full_name: 'C', meta: { fetch: 'pending_token' } };
      },
    };
    const out = await svc.syncProject('p1');
    expect(out.scanned).toBe(3);
    expect(out.skipped_empty).toBe(1);
    expect(out.enqueued).toBe(2);
    expect(out.already_queued).toBe(1);
    expect(out.created).toBe(1);
    expect(prepare).toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalled();
  });
});
