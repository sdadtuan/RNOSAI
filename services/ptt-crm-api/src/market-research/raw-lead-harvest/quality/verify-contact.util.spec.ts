import { verifyCandidate } from './verify-contact.util';

describe('verifyCandidate', () => {
  it('nulls phone not literal in evidence (BR-Q7)', () => {
    const v = verifyCandidate(
      {
        company_name: 'Spa Anh Duong',
        address: 'Ha Noi',
        phone: '0903111222',
        email: null,
        contact_title: null,
        website: 'https://spa.vn',
        evidence_url: 'https://spa.vn/lien-he',
        evidence_snippet: 'Spa Anh Duong welcome',
        discovered_via_source_key: null,
        confidence: 0.8,
      },
      { ok: true, text: 'Spa Anh Duong welcome — no phone here' },
    );
    expect(v.phone_ok).toBe(false);
    expect(v.reasons).toContain('brq7_phone_not_literal');
  });

  it('keeps phone when digits appear in HTML', () => {
    const v = verifyCandidate(
      {
        company_name: 'Spa Anh Duong',
        address: '12 Pho Hue, Ha Noi',
        phone: '+84 903 111 222',
        email: 'hi@spa.vn',
        contact_title: 'Chu spa',
        website: 'https://spa.vn',
        evidence_url: 'https://spa.vn/lien-he',
        evidence_snippet: 'Spa Anh Duong',
        discovered_via_source_key: 'google_maps',
        confidence: 0.9,
      },
      {
        ok: true,
        text: 'Spa Anh Duong — Hotline: 0903111222 — hi@spa.vn',
      },
    );
    expect(v.phone_ok).toBe(true);
    expect(v.email_ok).toBe(true);
    expect(v.fetch).toBe('ok');
  });
});
