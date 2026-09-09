import { describe, expect, it } from 'vitest';
import {
  assertLeadPartySendable,
  leadPartyClientLabel,
  prefillCompanyName,
  snapshotLeadParty,
} from './lead-party.util';

describe('prefillCompanyName', () => {
  it('does not map a person full_name to company', () => {
    expect(
      prefillCompanyName({
        column: '',
        meta: {},
        fullName: 'Tuan Truong',
      }),
    ).toBe('');
  });
});

describe('assertLeadPartySendable', () => {
  it('blocks send without company or contact', () => {
    expect(assertLeadPartySendable({ company_name: '', phone: '', email: '' }).ok).toBe(false);
    expect(assertLeadPartySendable({ company_name: '360 Auto', phone: '0901', email: '' }).ok).toBe(
      true,
    );
  });
});

describe('leadPartyClientLabel', () => {
  it('shows company_name or em dash, never a UUID', () => {
    expect(leadPartyClientLabel({ company_name: '360 Auto', client_id: 'aaaa-bbbb' })).toBe(
      '360 Auto',
    );
    expect(leadPartyClientLabel({ company_name: '', client_id: 'aaaa-bbbb' })).toBe('—');
  });
});

describe('snapshotLeadParty', () => {
  it('keeps contact_name separate from company_name', () => {
    const snap = snapshotLeadParty({
      company_name: '360 Auto',
      full_name: 'Tuan Truong',
      company_address: '',
      phone: '0901',
      email: '',
      logo_asset_id: null,
    });
    expect(snap.company_name).toBe('360 Auto');
    expect(snap.contact_name).toBe('Tuan Truong');
  });
});
