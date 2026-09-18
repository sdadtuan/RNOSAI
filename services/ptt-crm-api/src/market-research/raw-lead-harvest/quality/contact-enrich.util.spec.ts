import { mergeContactEnrichment, splitWebChannels } from './contact-enrich.util';
import { scrapeContactsFromText } from './scrape-contact.util';

describe('contact-enrich.util', () => {
  it('splits facebook website to fanpage', () => {
    expect(splitWebChannels('https://facebook.com/spa')).toEqual({
      website: null,
      fanpage_url: 'https://facebook.com/spa',
    });
  });

  it('merges places phone onto missing lead', () => {
    const out = mergeContactEnrichment({
      lead: { phone: null, email: null, website: null, fanpage_url: null },
      places: { phone: '0909479018', website: 'https://spa.example' },
    });
    expect(out.changed).toBe(true);
    expect(out.phone_norm).toBe('0909479018');
    expect(out.website).toBe('https://spa.example');
    expect(out.contactable).toBe(true);
    expect(out.sources).toContain('places_phone');
  });

  it('merges scraped phone when places empty', () => {
    const scraped = scrapeContactsFromText('Lien he: 0909 123 456');
    const out = mergeContactEnrichment({
      lead: { phone: null, email: null },
      scraped,
    });
    expect(out.phone_norm).toMatch(/^0909/);
    expect(out.sources).toContain('scrape_phone');
  });

  it('unchanged when already has phone', () => {
    const out = mergeContactEnrichment({
      lead: {
        phone: '0909479018',
        phone_norm: '0909479018',
        email: null,
        website: 'https://spa.example',
      },
      places: { phone: '02811112222' },
    });
    expect(out.phone).toBe('0909479018');
    expect(out.changed).toBe(false);
  });
});
