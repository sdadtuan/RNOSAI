import {
  defaultSourceForWebhookChannel,
  preparedLeadToCreateBody,
} from './webhook-nest-ingest.util';
import type { B2bPreparedLead } from '../b2b-projects/b2b-ingest.service';

describe('webhook-nest-ingest.util', () => {
  it('maps meta channel to facebook source', () => {
    expect(defaultSourceForWebhookChannel('meta')).toBe('facebook');
    expect(defaultSourceForWebhookChannel('zalo')).toBe('zalo');
    expect(defaultSourceForWebhookChannel('google')).toBe('google');
  });

  it('maps prepared B2B lead into CreateLeadV1Body with first-assign fields', () => {
    const lead: B2bPreparedLead = {
      client_id: '',
      channel: 'meta',
      external_lead_id: '1094276303353917',
      idempotency_key: 'idem-1',
      occurred_at: '2026-09-29T08:37:37Z',
      contact: { full_name: 'Quoc Tuan', phone: '+84901234567', email: 'a@b.c' },
      fields: {},
      raw: { meta: { facebook_form_id: 'F1' } },
      b2b_project_id: 'da5de896-1721-47e9-b645-e6b499b5dc04',
      owner_company_id: 'ptt-opco',
      lead_flow_kind: 'b2b_prospect',
    };
    const body = preparedLeadToCreateBody(lead);
    expect(body).toMatchObject({
      full_name: 'Quoc Tuan',
      phone: '+84901234567',
      email: 'a@b.c',
      channel: 'meta',
      source: 'facebook',
      external_lead_id: '1094276303353917',
      b2b_project_id: 'da5de896-1721-47e9-b645-e6b499b5dc04',
      lead_flow_kind: 'b2b_prospect',
      client_id: null,
    });
    expect(body.meta?.ingest_path).toBe('nest_webhook');
    expect(body.meta?.idempotency_key).toBe('idem-1');
  });

  it('falls back full_name from phone when contact name empty', () => {
    const body = preparedLeadToCreateBody({
      client_id: 'unknown',
      channel: 'meta',
      external_lead_id: 'x1',
      idempotency_key: 'k',
      occurred_at: '2026-09-29T00:00:00Z',
      contact: { full_name: '', phone: '0901', email: null },
      fields: {},
      raw: {},
    });
    expect(body.full_name).toBe('0901');
  });
});
