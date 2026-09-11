import {
  formatCopilotGlossaryPromptSection,
  matchGlossaryTerms,
  selectCopilotGlossary,
  type CmktGlossaryRow,
} from './copilot-glossary.util';

function glossary(
  partial: Partial<CmktGlossaryRow> & Pick<CmktGlossaryRow, 'id' | 'status'>,
): CmktGlossaryRow {
  return {
    lifecycle_id: 4,
    brand_id: 'brand-4',
    term: `term-${partial.id}`,
    locale: 'vi',
    preferred: '',
    expires_at: null,
    created_at: '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

describe('selectCopilotGlossary', () => {
  const now = new Date('2026-09-11T03:00:00.000Z');
  const scope = { brand_id: 'brand-4', locale: 'vi' };

  it('does not include a Draft glossary term in copilotGlossary', () => {
    const sources = selectCopilotGlossary(
      [glossary({ id: 1, status: 'Draft', term: 'draft-secret' })],
      now,
      scope,
    );
    expect(sources.map((row) => row.id)).not.toContain(1);
    expect(sources).toEqual([]);
  });

  it('includes an Approved unexpired glossary term', () => {
    const sources = selectCopilotGlossary(
      [
        glossary({
          id: 2,
          status: 'Approved',
          term: 'đăng ký nhận tư vấn',
          locale: 'vi',
          brand_id: 'brand-4',
          expires_at: '2026-12-01T00:00:00.000Z',
        }),
      ],
      now,
      scope,
    );
    expect(sources).toEqual([
      {
        id: 2,
        term: 'đăng ký nhận tư vấn',
        locale: 'vi',
        brand_id: 'brand-4',
        preferred: '',
        expires_at: '2026-12-01T00:00:00.000Z',
      },
    ]);
  });

  it('includes Approved glossary with null expires_at', () => {
    const sources = selectCopilotGlossary(
      [glossary({ id: 3, status: 'Approved', expires_at: null })],
      now,
      scope,
    );
    expect(sources.map((row) => row.id)).toEqual([3]);
  });

  it('does not include an expired Approved glossary term', () => {
    const sources = selectCopilotGlossary(
      [glossary({ id: 4, status: 'Approved', expires_at: '2026-09-10T23:59:59.000Z' })],
      now,
      scope,
    );
    expect(sources.map((row) => row.id)).not.toContain(4);
    expect(sources).toEqual([]);
  });

  it('excludes Rejected even when unexpired', () => {
    const sources = selectCopilotGlossary(
      [
        glossary({ id: 5, status: 'Rejected', expires_at: null }),
        glossary({ id: 6, status: 'Approved', term: 'keep' }),
      ],
      now,
      scope,
    );
    expect(sources.map((row) => row.id)).toEqual([6]);
  });

  it('does not mix another brand or locale when both are known', () => {
    const sources = selectCopilotGlossary(
      [
        glossary({ id: 7, status: 'Approved', term: 'keep-vi', brand_id: 'brand-4', locale: 'vi' }),
        glossary({ id: 8, status: 'Approved', term: 'other-brand', brand_id: 'brand-9', locale: 'vi' }),
        glossary({ id: 9, status: 'Approved', term: 'other-locale', brand_id: 'brand-4', locale: 'en' }),
      ],
      now,
      { brand_id: 'brand-4', locale: 'vi' },
    );
    expect(sources.map((row) => row.term)).toEqual(['keep-vi']);
  });

  it('returns no terms when brand_id is missing on the item (fail closed)', () => {
    const sources = selectCopilotGlossary(
      [glossary({ id: 10, status: 'Approved', term: 'dump-all-brands' })],
      now,
      { locale: 'vi' },
    );
    expect(sources).toEqual([]);
  });

  it('returns no terms when locale is missing on the item (fail closed)', () => {
    const sources = selectCopilotGlossary(
      [glossary({ id: 11, status: 'Approved', term: 'dump-all-locales' })],
      now,
      { brand_id: 'brand-4' },
    );
    expect(sources).toEqual([]);
  });
});

describe('formatCopilotGlossaryPromptSection', () => {
  it('returns a labeled section used by draft prompts', () => {
    const section = formatCopilotGlossaryPromptSection([
      {
        id: 2,
        term: 'đăng ký nhận tư vấn',
        locale: 'vi',
        brand_id: 'brand-4',
        preferred: 'book a consult',
        expires_at: null,
      },
    ]);
    expect(section).toContain('Approved glossary (copilot whitelist)');
    expect(section).toContain('#2');
    expect(section).toContain('đăng ký nhận tư vấn');
    expect(section).toContain('book a consult');
    expect(section).not.toMatch(/SELECT |cmkt_glossary/i);
  });

  it('returns empty string when there are no whitelist terms', () => {
    expect(formatCopilotGlossaryPromptSection([])).toBe('');
  });
});

describe('matchGlossaryTerms', () => {
  it('returns only terms found in copy and invents none', () => {
    expect(matchGlossaryTerms('Please đăng ký nhận tư vấn today', ['đăng ký nhận tư vấn', 'unused'])).toEqual([
      'đăng ký nhận tư vấn',
    ]);
    expect(matchGlossaryTerms('plain copy', [])).toEqual([]);
    expect(matchGlossaryTerms('', ['đăng ký nhận tư vấn'])).toEqual([]);
  });
});
