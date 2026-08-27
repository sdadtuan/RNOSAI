import {
  clampFacebookSyncLimit,
  classifyFetchedLead,
  isMissingFormPermissionError,
  parseFacebookFormLeadsPage,
  selectActiveFormsToSync,
} from './meta-lead-sync.util';

describe('clampFacebookSyncLimit', () => {
  it('defaults to 50 and caps at 100', () => {
    expect(clampFacebookSyncLimit(undefined)).toBe(50);
    expect(clampFacebookSyncLimit(0)).toBe(50);
    expect(clampFacebookSyncLimit(3)).toBe(3);
    expect(clampFacebookSyncLimit(999)).toBe(100);
  });
});

describe('selectActiveFormsToSync', () => {
  const pages = [
    {
      page_id: 'P1',
      active: true,
      forms: [
        { form_id: 'F1', active: true },
        { form_id: 'F2', active: false },
      ],
    },
    {
      page_id: 'P2',
      active: false,
      forms: [{ form_id: 'F3', active: true }],
    },
  ];

  it('returns only active forms on active pages', () => {
    expect(selectActiveFormsToSync(pages)).toEqual([{ pageId: 'P1', formId: 'F1' }]);
  });

  it('filters to one form_id when requested', () => {
    expect(selectActiveFormsToSync(pages, 'F1')).toEqual([{ pageId: 'P1', formId: 'F1' }]);
    expect(selectActiveFormsToSync(pages, 'F2')).toEqual([]);
  });
});

describe('parseFacebookFormLeadsPage', () => {
  it('reads lead ids and next page url', () => {
    const out = parseFacebookFormLeadsPage({
      data: [{ id: '111' }, { id: '222', created_time: '2026-08-01' }, { id: '' }],
      paging: { next: 'https://graph.facebook.com/next' },
    });
    expect(out.ids).toEqual(['111', '222']);
    expect(out.nextUrl).toBe('https://graph.facebook.com/next');
  });

  it('returns empty when Graph error payload', () => {
    const out = parseFacebookFormLeadsPage({ error: { message: 'nope' } });
    expect(out.ids).toEqual([]);
    expect(out.nextUrl).toBeNull();
    expect(out.errorMessage).toMatch(/nope/);
  });
});

describe('isMissingFormPermissionError', () => {
  it('detects Meta unsupported-object errors', () => {
    expect(
      isMissingFormPermissionError(
        "Unsupported get request. Object with ID '1' does not exist, cannot be loaded due to missing permissions",
      ),
    ).toBe(true);
    expect(isMissingFormPermissionError('rate limit')).toBe(false);
  });
});

describe('classifyFetchedLead', () => {
  it('ok when phone or email present', () => {
    expect(classifyFetchedLead({ phone: '0901', email: '', full_name: 'A' })).toBe('ok');
    expect(classifyFetchedLead({ phone: '', email: 'a@b.c', full_name: '' })).toBe('ok');
  });

  it('empty_contact when no phone/email', () => {
    expect(classifyFetchedLead({ phone: '', email: '', full_name: 'A' })).toBe('empty_contact');
  });

  it('graph_error when fetch failed', () => {
    expect(
      classifyFetchedLead({
        phone: '',
        email: '',
        meta: { fetch: 'graph_error', status: 400 },
      }),
    ).toBe('graph_error');
  });
});
