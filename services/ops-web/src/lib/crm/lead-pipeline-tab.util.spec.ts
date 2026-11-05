import { afterEach, describe, expect, it } from 'vitest';
import {
  defaultLeadWorkspaceTab,
  leadDetailHref,
  mapLegacyHashToPipeline,
  pipelineStepQuery,
  shouldShowPipelineTab,
} from './lead-pipeline-tab.util';

describe('shouldShowPipelineTab', () => {
  it('hides for spa_operational', () => {
    expect(shouldShowPipelineTab('spa_operational')).toBe(false);
  });
  it('shows for b2b_prospect', () => {
    expect(shouldShowPipelineTab('b2b_prospect')).toBe(true);
  });
});

describe('mapLegacyHashToPipeline', () => {
  it('maps #funnel-b2 to b2', () => {
    expect(mapLegacyHashToPipeline('#funnel-b2')).toEqual({ tab: 'pipeline', step: 'b2' });
  });
  it('maps #funnel-presales without stage to Pre Sale', () => {
    expect(mapLegacyHashToPipeline('#funnel-presales')).toEqual({
      tab: 'pipeline',
      step: 'intake_bant',
    });
  });
  it('maps #funnel-presales after intake complete (consult stage) to consult', () => {
    expect(mapLegacyHashToPipeline('#funnel-presales', 'consult')).toEqual({
      tab: 'pipeline',
      step: 'consult',
    });
  });
  it('maps #funnel-presales-r5 proposal stage to proposal', () => {
    expect(mapLegacyHashToPipeline('#funnel-presales-r5', 'proposal')).toEqual({
      tab: 'pipeline',
      step: 'proposal',
    });
  });
  it('returns null for empty hash', () => {
    expect(mapLegacyHashToPipeline('')).toBeNull();
  });
});

describe('defaultLeadWorkspaceTab', () => {
  const base = {
    flowKind: 'b2b_prospect' as const,
    status: 'moi',
    contractActive: false,
    hash: '',
    searchTab: null,
    showConsult: false,
    showLmp: false,
  };

  it('defaults B2B to pipeline', () => {
    expect(defaultLeadWorkspaceTab(base)).toBe('pipeline');
  });
  it('defaults won+contract to contract', () => {
    expect(
      defaultLeadWorkspaceTab({ ...base, status: 'won', contractActive: true }),
    ).toBe('contract');
  });
  it('defaults lost to pipeline', () => {
    expect(defaultLeadWorkspaceTab({ ...base, status: 'lost' })).toBe('pipeline');
  });
  it('honors ?tab=consult when consult visible', () => {
    expect(
      defaultLeadWorkspaceTab({ ...base, searchTab: 'consult', showConsult: true }),
    ).toBe('consult');
  });
  it('honors ?tab=history on B2B lead', () => {
    expect(defaultLeadWorkspaceTab({ ...base, searchTab: 'history' })).toBe('history');
  });
  it('maps legacy hash over default', () => {
    expect(defaultLeadWorkspaceTab({ ...base, hash: '#funnel-b2' })).toBe('pipeline');
  });
  it('opens the contract tab from #lead-contract', () => {
    expect(defaultLeadWorkspaceTab({ ...base, hash: '#lead-contract' })).toBe('contract');
  });
});

describe('pipelineStepQuery', () => {
  it('builds query for readiness links', () => {
    expect(pipelineStepQuery('b2')).toBe('?tab=pipeline&step=b2');
  });
});

describe('leadDetailHref', () => {
  const prev = process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB;
  afterEach(() => {
    process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB = prev;
  });

  it('keeps plain href when flag off', () => {
    process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB = '0';
    expect(leadDetailHref(9)).toBe('/crm/leads/9');
  });

  it('adds pipeline tab when flag on', () => {
    process.env.NEXT_PUBLIC_LEAD_PIPELINE_TAB = '1';
    expect(leadDetailHref(9)).toBe('/crm/leads/9?tab=pipeline');
  });
});
