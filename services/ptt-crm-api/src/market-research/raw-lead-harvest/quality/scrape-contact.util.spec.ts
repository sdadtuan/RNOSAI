import {
  contactPageUrls,
  mergeScrapedContacts,
  scrapeContactsFromText,
} from './scrape-contact.util';

describe('scrape-contact.util', () => {
  it('extracts VN mobile and landline from page text', () => {
    const out = scrapeContactsFromText(
      'Hotline: 028 3822 1234 · Zalo 0909.479.018 · Fax 028 1111 2222',
    );
    expect(out.phone).toBe('0909479018');
    expect(out.phones).toContain('02838221234');
  });

  it('extracts emails and skips noreply', () => {
    const out = scrapeContactsFromText(
      'Liên hệ: contact@myspa.vn hoặc noreply@myspa.vn',
    );
    expect(out.email).toBe('contact@myspa.vn');
    expect(out.emails).not.toContain('noreply@myspa.vn');
  });

  it('builds lien-he candidates from homepage', () => {
    expect(contactPageUrls('https://myspa.vn/')).toEqual(
      expect.arrayContaining([
        'https://myspa.vn/lien-he',
        'https://myspa.vn/contact',
      ]),
    );
    expect(contactPageUrls('https://myspa.vn/lien-he')).not.toContain(
      'https://myspa.vn/lien-he',
    );
  });

  it('merge prefers AI values then scraped', () => {
    expect(
      mergeScrapedContacts(
        { phone: null, email: 'a@b.vn' },
        { phone: '0901111222', email: 'c@d.vn', phones: ['0901111222'], emails: ['c@d.vn'] },
      ),
    ).toEqual({ phone: '0901111222', email: 'a@b.vn', scraped: true });
  });
});
