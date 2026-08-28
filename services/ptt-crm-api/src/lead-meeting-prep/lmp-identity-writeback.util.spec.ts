import {
  buildAmManualIdentityMetaPatch,
  buildDiscoverSelectionMetaPatch,
  discoverSourceLabelVi,
  extractLmpLeadIdentity,
} from './lmp-identity-writeback.util';

describe('lmp-identity-writeback.util', () => {
  it('builds AM manual identity patch', () => {
    const patch = buildAmManualIdentityMetaPatch({
      companyName: 'Cty ABC',
      websiteUrl: 'https://abc.vn',
      actorEmail: 'am@test.vn',
    });
    expect(patch.company_name).toBe('Cty ABC');
    expect(patch.website_url).toBe('https://abc.vn');
    const discover = patch.lmp_discover as Record<string, unknown>;
    expect(discover.discover_source).toBe('am_manual');
    expect(discover.confirmed_by_am).toBe(true);
    expect(discover.confirmed_by).toBe('am@test.vn');
  });

  it('builds discover selection patch with AM confirmation', () => {
    const patch = buildDiscoverSelectionMetaPatch(
      {
        discover_status: 'found_multiple',
        meta: { discovered_at: '2026-08-28T10:00:00Z' },
        candidates: [
          {
            candidate_id: 'c1',
            company_name: 'Cty XYZ',
            website_url: 'https://xyz.vn',
            source_url: 'https://masothue.com/1',
          },
        ],
      },
      'c1',
      { confirmedByAm: true, actorEmail: 'am@test.vn' },
    );
    expect(patch.company_name).toBe('Cty XYZ');
    const discover = patch.lmp_discover as Record<string, unknown>;
    expect(discover.discover_source).toBe('am_confirmed');
    expect(discover.confirmed_by_am).toBe(true);
  });

  it('extracts lead identity from meta_json', () => {
    const identity = extractLmpLeadIdentity({
      company_name: 'Cty ABC',
      website_url: 'https://abc.vn',
      lmp_discover: {
        discover_source: 'auto',
        confirmed_by_am: false,
        source_url: 'https://masothue.com/1',
        candidate_id: 'c1',
      },
    });
    expect(identity?.company_name).toBe('Cty ABC');
    expect(identity?.discover_source).toBe('auto');
    expect(discoverSourceLabelVi('auto')).toBe('AI tự tìm');
  });
});
