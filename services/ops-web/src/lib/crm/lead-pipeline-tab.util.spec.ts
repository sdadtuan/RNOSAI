import { describe, expect, it } from 'vitest';
import {
  defaultLeadWorkspaceTab,
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
  it('maps #funnel-presales without stage to presales_lead', () => {
    expect(mapLegacyHashToPipeline('#funnel-presales')).toEqual({
      tab: 'pipeline',
      step: 'presales_lead',
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
  it('maps legacy hash over default', () => {
    expect(defaultLeadWorkspaceTab({ ...base, hash: '#funnel-b2' })).toBe('pipeline');
  });
});

describe('pipelineStepQuery', () => {
  it('builds query for readiness links', () => {
    expect(pipelineStepQuery('b2')).toBe('?tab=pipeline&step=b2');
  });
});
