import {
  buildLeadFlowKindListFilter,
  buildSpaOperationalListFilter,
} from './lead-flow-list-filter.util';

describe('lead-flow-list-filter.util', () => {
  it('builds spa filter with explicit meta and client guard', () => {
    const sql = buildSpaOperationalListFilter('postgres', 'l');
    expect(sql).toContain("l.meta_json->>'lead_flow_kind'");
    expect(sql).toContain('l.agency_client_id IS NOT NULL');
    expect(sql).toContain("'won', 'proposal'");
  });

  it('builds b2b filter as complement of spa', () => {
    const sql = buildLeadFlowKindListFilter('b2b_prospect', 'postgres', 'l');
    expect(sql).toMatch(/^(\(NOT \()/);
    expect(sql).toContain(buildSpaOperationalListFilter('postgres', 'l'));
  });

  it('supports sqlite dialect for funnel sqlite reads', () => {
    const sql = buildLeadFlowKindListFilter('spa_operational', 'sqlite', 'l');
    expect(sql).toContain("json_extract(l.meta_json, '$.lead_flow_kind')");
    expect(sql).toContain("json_extract(l.meta_json, '$.agency_client_id')");
  });
});
