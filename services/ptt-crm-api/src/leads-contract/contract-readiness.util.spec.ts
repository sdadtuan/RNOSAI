import { buildReadinessChecks } from './contract-readiness.util';

describe('buildReadinessChecks', () => {
  it('requires all presales stages and marketing plan', () => {
    const checks = buildReadinessChecks({
      careStageCurrent: 'first_contact',
      careStagesDoneJson: JSON.stringify({ first_contact: { care_status: 'da_lien_he_thanh_cong' } }),
      presales: {
        stage: 'proposal',
        status: 'active',
        tasksProgress: {
          lead: { total: 1, done: 1 },
          consult: { total: 1, done: 1 },
          proposal: { total: 1, done: 0 },
        },
      },
      marketingPlan: null,
      contract: null,
      pendingApproval: null,
    });
    expect(checks.find((c) => c.key === 'presales_proposal')?.ok).toBe(false);
    expect(checks.find((c) => c.key === 'marketing_plan')?.ok).toBe(false);
    expect(checks.find((c) => c.key === 'contract_draft')?.ok).toBe(false);
  });

  it('treats earlier gates as done after the quote is approved', () => {
    const checks = buildReadinessChecks({
      careStageCurrent: 'follow_up',
      careStagesDoneJson: '{}',
      presales: {
        stage: 'proposal',
        status: 'active',
        tasksProgress: {
          lead: { total: 0, done: 0 },
          consult: { total: 0, done: 0 },
          proposal: { total: 0, done: 0 },
        },
      },
      marketingPlan: null,
      contract: null,
      pendingApproval: null,
      quoteApproved: true,
    });
    expect(checks.find((c) => c.key === 'b2_complete')?.ok).toBe(true);
    expect(checks.find((c) => c.key === 'presales_lead')?.ok).toBe(true);
    expect(checks.find((c) => c.key === 'presales_consult')?.ok).toBe(true);
    expect(checks.find((c) => c.key === 'presales_proposal')?.ok).toBe(true);
    expect(checks.find((c) => c.key === 'marketing_plan')?.ok).toBe(true);
    expect(checks.find((c) => c.key === 'contract_draft')?.ok).toBe(false);
  });
});
