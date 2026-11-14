import { canGenerateConsultAi, canRunSolutionAiDraft } from './staff-consult-ai.guard';

describe('canGenerateConsultAi', () => {
  it('allows Account Manager consult edit plus generate, without the production board', () => {
    expect(
      canGenerateConsultAi([
        { section: 'crm_presales_solution', action: 'edit' },
        { section: 'crm_mkt_ai', action: 'generate' },
      ]),
    ).toBe(true);
  });

  it('still requires generate', () => {
    expect(
      canGenerateConsultAi([{ section: 'crm_presales_solution', action: 'edit' }]),
    ).toBe(false);
  });

  it('keeps the board path', () => {
    expect(
      canGenerateConsultAi([
        { section: 'crm_board', action: 'edit' },
        { section: 'crm_mkt_ai', action: 'generate' },
      ]),
    ).toBe(true);
  });
});

describe('canRunSolutionAiDraft', () => {
  it('allows Super-Admin without crm_mkt_ai generate', () => {
    expect(canRunSolutionAiDraft({ isSuperAdmin: true, caps: [] })).toBe(true);
  });

  it('allows Account Manager without crm_mkt_ai generate', () => {
    expect(canRunSolutionAiDraft({ isAccountManager: true, caps: [] })).toBe(true);
  });

  it('still requires caps for other roles', () => {
    expect(canRunSolutionAiDraft({ caps: [{ section: 'crm_presales_solution', action: 'edit' }] })).toBe(
      false,
    );
  });
});
