import { describe, expect, it } from 'vitest';
import type { StoredStaffUser } from '@/lib/auth';
import {
  canDraftConsultPlan,
  canViewCrmLeadDetail,
  resolvePresalesSolutionCaps,
} from './presales-solution-caps';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

describe('resolvePresalesSolutionCaps', () => {
  it('AE with leads.assign alone cannot claim/release (no GDKD bridge)', () => {
    const caps = resolvePresalesSolutionCaps(
      user([
        { section: 'crm_leads', action: 'view' },
        { section: 'crm_leads', action: 'assign' },
        { section: 'crm_presales_solution', action: 'view' },
      ]),
    );
    expect(caps.canClaim).toBe(false);
    expect(caps.canRelease).toBe(false);
    expect(caps.isAeTrackOnly).toBe(true);
  });

  it('Solution role can claim/release', () => {
    const caps = resolvePresalesSolutionCaps(
      user([
        { section: 'crm_presales_solution', action: 'view' },
        { section: 'crm_presales_solution', action: 'claim' },
        { section: 'crm_presales_solution', action: 'release' },
      ]),
    );
    expect(caps.canClaim).toBe(true);
    expect(caps.canRelease).toBe(true);
    expect(caps.isAeTrackOnly).toBe(false);
  });

  it('Account Manager drafts the consult plan without crm_board.edit', () => {
    expect(
      canDraftConsultPlan(
        user([
          { section: 'crm_presales_solution', action: 'edit' },
          { section: 'crm_mkt_ai', action: 'generate' },
        ]),
      ),
    ).toBe(true);
  });

  it('CEO/GĐKD via crm_gdkd can claim', () => {
    const caps = resolvePresalesSolutionCaps(
      user([
        { section: 'crm_gdkd', action: 'view_all_leads' },
        { section: 'crm_presales_solution', action: 'view' },
      ]),
    );
    expect(caps.isGdkd).toBe(true);
    expect(caps.canClaim).toBe(true);
  });

  it('flagged non-AM can claim Solution without the AM cap', () => {
    const caps = resolvePresalesSolutionCaps({
      id: '2',
      email: 'ae@pttads.vn',
      display_name: 'AE',
      position_id: 3,
      position_code: 'ae',
      can_receive_solution: true,
      caps: [
        { section: 'crm_leads', action: 'view' },
        { section: 'crm_presales_solution', action: 'view' },
      ],
    });
    expect(caps.canClaim).toBe(true);
    expect(caps.canRelease).toBe(true);
    expect(caps.isAeTrackOnly).toBe(false);
  });

  it('unflagged AE cannot claim Solution', () => {
    const caps = resolvePresalesSolutionCaps({
      id: '3',
      email: 'ae2@pttads.vn',
      display_name: 'AE2',
      position_id: 3,
      position_code: 'ae',
      can_receive_solution: false,
      caps: [
        { section: 'crm_leads', action: 'view' },
        { section: 'crm_presales_solution', action: 'view' },
      ],
    });
    expect(caps.canClaim).toBe(false);
    expect(caps.isAeTrackOnly).toBe(true);
  });

  it('canViewCrmLeadDetail allows Solution view without crm_leads.view', () => {
    expect(canViewCrmLeadDetail(user([{ section: 'crm_presales_solution', action: 'view' }]))).toBe(
      true,
    );
    expect(canViewCrmLeadDetail(user([{ section: 'crm_leads', action: 'edit' }]))).toBe(false);
  });
});
