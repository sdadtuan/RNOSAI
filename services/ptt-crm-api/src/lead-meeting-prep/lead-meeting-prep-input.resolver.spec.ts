import { LeadMeetingPrepInputResolver } from './lead-meeting-prep-input.resolver';
import { companyHintFromEmailDomain } from './lmp-tier1-hints.util';
import type { LeadPrepContextRow } from './lead-meeting-prep.types';

describe('LeadMeetingPrepInputResolver', () => {
  const resolver = new LeadMeetingPrepInputResolver();

  const baseRow = (): LeadPrepContextRow => ({
    lead_id: 1,
    full_name: 'Nguyen Van A',
    phone: '0900123456',
    email: 'a@example.com',
    status: 'moi',
    source: 'web',
    channel: 'manual',
    client_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    is_duplicate: false,
    meta_json: {
      company_name: 'Cty Demo LMP',
      industry: 'BDS',
      notes: 'Can tang lead',
    },
  });

  it('resolves company from meta_json', () => {
    const out = resolver.resolve(baseRow());
    expect(out.input.company_name).toBe('Cty Demo LMP');
    expect(out.skip_reason).toBeUndefined();
    expect(out.needs_am_input).toBeUndefined();
  });

  it('needs AM input when company missing but contact present', () => {
    const row = baseRow();
    row.meta_json = {};
    row.email = 'user@gmail.com';
    const out = resolver.resolve(row);
    expect(out.skip_reason).toBeUndefined();
    expect(out.needs_am_input).toBe('missing_company_name');
  });

  it('skips when contact missing', () => {
    const row = baseRow();
    row.phone = '';
    row.email = '';
    const out = resolver.resolve(row);
    expect(out.skip_reason).toBe('missing_contact');
  });

  it('infers company from corporate email domain', () => {
    const row = baseRow();
    row.email = 'sales@acmecorp.vn';
    row.meta_json = {};
    const out = resolver.resolve(row);
    expect(out.input.company_name).toBe('Acmecorp');
    expect(out.input.website_url).toBe('https://acmecorp.vn');
    expect(out.sources_map.company_name).toBe('email_domain');
    expect(out.needs_am_input).toBeUndefined();
  });

  it('skips duplicate leads for auto enqueue', () => {
    const row = baseRow();
    row.is_duplicate = true;
    expect(
      resolver.isEligibleForAutoEnqueue(row, {
        pilotClientIds: [],
      }),
    ).toBe('duplicate_lead');
  });
});

describe('companyHintFromEmailDomain', () => {
  it('ignores free email providers', () => {
    expect(companyHintFromEmailDomain('a@gmail.com')).toEqual({});
  });
});
