import { evaluatePolicy } from './policy.engine';
import { PolicyContext } from './policy.types';

describe('PolicyEngine WIN-4-C', () => {
  const releaseCtx = (patch: Partial<PolicyContext> = {}): PolicyContext => ({
    action: 'release',
    handoff_status: 'with_solution',
    has_handoff_activity: true,
    consult_complete: true,
    preliminary_plan_ok: true,
    ...patch,
  });

  it('allows release when handoff path complete', () => {
    const out = evaluatePolicy('presales.no_release_without_handoff', releaseCtx());
    expect(out.allow).toBe(true);
  });

  it('denies release without handoff activity (EC-W4-05)', () => {
    const out = evaluatePolicy(
      'presales.no_release_without_handoff',
      releaseCtx({ has_handoff_activity: false, handoff_status: 'pending' }),
    );
    expect(out.allow).toBe(false);
    expect(out.policy_id).toBe('presales.no_release_without_handoff');
  });

  it('allows claim for Account Manager position', () => {
    const out = evaluatePolicy('presales.no_claim_without_mkt_set', {
      action: 'claim',
      position_code: 'KD-01',
    });
    expect(out.allow).toBe(true);
  });

  it('denies claim without AM desk or set', () => {
    const out = evaluatePolicy('presales.no_claim_without_mkt_set', {
      action: 'claim',
      job_functions: ['content'],
      permission_sets: ['MKT-SOLUTION'],
    });
    expect(out.allow).toBe(false);
    expect(out.policy_id).toBe('presales.no_claim_without_mkt_set');
  });

  it('allows claim when can_receive_solution is set', () => {
    const out = evaluatePolicy('presales.no_claim_without_mkt_set', {
      action: 'claim',
      position_code: 'ae',
      can_receive_solution: true,
    });
    expect(out.allow).toBe(true);
  });

  it('allows claim via AM permission set', () => {
    const out = evaluatePolicy('presales.no_claim_without_mkt_set', {
      action: 'claim',
      permission_sets: ['KD-01-AM'],
    });
    expect(out.allow).toBe(true);
  });

  it('denies expired break-glass union', () => {
    const out = evaluatePolicy('rbac.break_glass_not_expired', {
      action: 'break_glass_union',
      break_glass_active: true,
      break_glass_expired: true,
    });
    expect(out.allow).toBe(false);
    expect(out.policy_id).toBe('rbac.break_glass_not_expired');
  });

  it('allows active break-glass within TTL', () => {
    const out = evaluatePolicy('rbac.break_glass_not_expired', {
      action: 'break_glass_union',
      break_glass_active: true,
      break_glass_expired: false,
    });
    expect(out.allow).toBe(true);
  });

  it('allows discovery-flow release with only a Solution file (no consult/plan)', () => {
    const out = evaluatePolicy(
      'presales.no_release_without_handoff',
      releaseCtx({
        consult_complete: false,
        preliminary_plan_ok: false,
        has_handoff_activity: true,
        discovery_handoff_flow: true,
        has_solution_file: true,
      }),
    );
    expect(out.allow).toBe(true);
  });

  it('denies discovery-flow release without a Solution file', () => {
    const out = evaluatePolicy(
      'presales.no_release_without_handoff',
      releaseCtx({
        consult_complete: false,
        preliminary_plan_ok: false,
        discovery_handoff_flow: true,
        has_solution_file: false,
      }),
    );
    expect(out.allow).toBe(false);
    expect(out.reason).toMatch(/Solution file/);
  });

  it('keeps legacy deny when discovery flag is off and consult is incomplete', () => {
    const out = evaluatePolicy(
      'presales.no_release_without_handoff',
      releaseCtx({
        consult_complete: false,
        preliminary_plan_ok: false,
        discovery_handoff_flow: false,
        has_solution_file: true,
      }),
    );
    expect(out.allow).toBe(false);
    expect(out.reason).toMatch(/Consult tasks/);
  });
});
