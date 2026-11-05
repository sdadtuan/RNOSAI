import {
  emailDomainMatchesWebsite,
  isDenylistedEvidenceHost,
  isDisposableOrExampleEmail,
  isGenericCompanyName,
  isSearchEvidenceUrl,
  isSequentialOrRepeatedPhone,
} from './brq-patterns.util';

describe('brq-patterns.util', () => {
  it('rejects sequential phones (BR-Q1)', () => {
    expect(isSequentialOrRepeatedPhone('0123456789')).toBe(true);
    expect(isSequentialOrRepeatedPhone('0987654321')).toBe(true);
    expect(isSequentialOrRepeatedPhone('0903111222')).toBe(false);
  });

  it('rejects example emails', () => {
    expect(isDisposableOrExampleEmail('a@example.com')).toBe(true);
  });

  it('rejects google search evidence (BR-Q4)', () => {
    expect(isSearchEvidenceUrl('https://www.google.com/search?q=spa+hn')).toBe(true);
    expect(isSearchEvidenceUrl('https://myspa.vn/lien-he')).toBe(false);
  });

  it('allows Google Maps place URLs as evidence (not SERP)', () => {
    expect(
      isSearchEvidenceUrl(
        'https://maps.google.com/?cid=11226590595882857272&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
      ),
    ).toBe(false);
    expect(
      isSearchEvidenceUrl('https://www.google.com/maps/place/?q=place_id:ChIJNR5_z3jddDEROLNWeqrczJs'),
    ).toBe(false);
  });

  it('flags denylist hosts (BR-Q9)', () => {
    expect(isDenylistedEvidenceHost('https://facebook.com/spa')).toBe(true);
  });

  it('detects generic company names (BR-Q3)', () => {
    expect(isGenericCompanyName('Công ty TNHH ABC')).toBe(true);
  });

  it('corporate email domain match (BR-Q8 helper)', () => {
    expect(emailDomainMatchesWebsite('hi@myspa.vn', 'https://www.myspa.vn')).toBe(true);
    expect(emailDomainMatchesWebsite('hi@gmail.com', 'https://www.myspa.vn')).toBe(false);
  });
});
