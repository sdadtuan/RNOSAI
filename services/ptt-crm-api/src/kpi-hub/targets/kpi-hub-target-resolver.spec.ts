import { resolveTarget, scopeHashFromChain, type HubTargetCandidate } from './kpi-hub-target-resolver';

describe('kpi-hub-target-resolver', () => {
  const candidates: HubTargetCandidate[] = [
    {
      id: 'ws',
      hierarchy_level: 'WORKSPACE',
      scope_hash: 'w:default',
      scope_label: 'Marketing toàn bộ',
      target_value: 150000,
      warning_value: 180000,
      critical_value: 220000,
      direction: 'LOWER_IS_BETTER',
    },
    {
      id: 'team',
      hierarchy_level: 'TEAM',
      scope_hash: 't:sales-a',
      scope_label: 'Team Sales A',
      target_value: 140000,
      warning_value: 170000,
      critical_value: 200000,
      direction: 'LOWER_IS_BETTER',
    },
    {
      id: 'camp',
      hierarchy_level: 'CAMPAIGN',
      scope_hash: 'c:bdsk3',
      scope_label: 'Campaign BĐS Q3',
      target_value: 130000,
      warning_value: 160000,
      critical_value: 190000,
      direction: 'LOWER_IS_BETTER',
    },
  ];

  it('Campaign overrides Team and Workspace', () => {
    const resolved = resolveTarget(candidates, {
      campaign: 'BĐS Q3',
      team: 'Sales A',
    });
    expect(resolved?.id).toBe('camp');
  });

  it('Team overrides Workspace when no campaign match', () => {
    const resolved = resolveTarget(candidates, { team: 'Sales A' });
    expect(resolved?.id).toBe('team');
  });

  it('falls back to Workspace', () => {
    const resolved = resolveTarget(candidates, {});
    expect(resolved?.id).toBe('ws');
  });

  it('scopeHashFromChain includes campaign', () => {
    expect(scopeHashFromChain({ campaign: 'x', team: 'y' })).toContain('c:x');
  });

  it('PROJECT overrides TEAM and WORKSPACE', () => {
    const projectCandidates: HubTargetCandidate[] = [
      {
        id: 'ws',
        hierarchy_level: 'WORKSPACE',
        scope_hash: 'w:default',
        scope_label: 'WS',
        target_value: 10,
        warning_value: null,
        critical_value: null,
        direction: 'HIGHER_IS_BETTER',
      },
      {
        id: 'prj',
        hierarchy_level: 'PROJECT',
        scope_hash: 'p:proj-1',
        scope_label: 'proj-1',
        target_value: 20,
        warning_value: null,
        critical_value: null,
        direction: 'HIGHER_IS_BETTER',
      },
    ];
    expect(resolveTarget(projectCandidates, { project_id: 'proj-1', team: 'A' })?.id).toBe('prj');
  });

  it('scopeHashFromChain prefixes project id', () => {
    expect(scopeHashFromChain({ project_id: 'proj-1', team: 'A' })).toBe('p:proj-1|t:A|w:default');
  });
});
