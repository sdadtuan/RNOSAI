import { ConflictException } from '@nestjs/common';
import { WebhookNestIngestService } from './webhook-nest-ingest.service';

describe('WebhookNestIngestService', () => {
  it('creates leads via Nest and counts duplicates', async () => {
    const createLead = jest
      .fn()
      .mockResolvedValueOnce({ id: 101, owner_id: 7 })
      .mockRejectedValueOnce(
        new ConflictException({
          error: 'duplicate_external_id',
          message: 'exists',
          lead_id: 99,
        }),
      );
    const enqueueIngestLeads = jest.fn();
    const svc = new WebhookNestIngestService(
      { webhookNestIngestEnabled: true } as never,
      { createLead } as never,
      { enqueueIngestLeads } as never,
    );

    const out = await svc.ingestPreparedLeads(
      [
        {
          client_id: '',
          channel: 'meta',
          external_lead_id: 'A',
          idempotency_key: 'k1',
          occurred_at: '2026-09-29T00:00:00Z',
          contact: { full_name: 'A', phone: '0901', email: null },
          fields: {},
          raw: {},
          b2b_project_id: 'p1',
          lead_flow_kind: 'b2b_prospect',
        },
        {
          client_id: '',
          channel: 'meta',
          external_lead_id: 'B',
          idempotency_key: 'k2',
          occurred_at: '2026-09-29T00:00:00Z',
          contact: { full_name: 'B', phone: '0902', email: null },
          fields: {},
          raw: {},
          b2b_project_id: 'p1',
          lead_flow_kind: 'b2b_prospect',
        },
      ],
      { channel: 'meta', correlationId: 'c1' },
    );

    expect(out.mode).toBe('nest');
    expect(out.created).toBe(1);
    expect(out.duplicates).toBe(1);
    expect(out.failed).toBe(0);
    expect(out.lead_ids).toEqual([101, 99]);
    expect(createLead).toHaveBeenCalledTimes(2);
    expect(enqueueIngestLeads).not.toHaveBeenCalled();
    expect(createLead.mock.calls[0][0].source).toBe('facebook');
    expect(createLead.mock.calls[0][0].b2b_project_id).toBe('p1');
    expect(createLead.mock.calls[0][0].lead_flow_kind).toBe('b2b_prospect');
  });

  it('falls back to Python job queue when nest ingest disabled', async () => {
    const enqueueIngestLeads = jest.fn(async () => ({
      mode: 'queue',
      jobs: [{ id: 'j1', created: true }],
    }));
    const svc = new WebhookNestIngestService(
      { webhookNestIngestEnabled: false } as never,
      { createLead: jest.fn() } as never,
      { enqueueIngestLeads } as never,
    );
    const out = await svc.ingestPreparedLeads(
      [
        {
          client_id: 'c',
          channel: 'meta',
          external_lead_id: 'A',
          idempotency_key: 'k',
          occurred_at: '2026-09-29T00:00:00Z',
          contact: { full_name: 'A', phone: '1', email: null },
          fields: {},
          raw: {},
        },
      ],
      { channel: 'meta' },
    );
    expect(out.mode).toBe('queue');
    expect(out.created).toBe(1);
    expect(enqueueIngestLeads).toHaveBeenCalled();
  });
});
