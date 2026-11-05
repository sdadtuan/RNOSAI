import { canGenerateConsultAi } from './staff-consult-ai.guard';

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
