import {
  hasCeoAct,
  hasCeoConfigure,
  hasCeoView,
} from './ceo-command-caps.util';

describe('ceo-command-caps.util', () => {
  it('AM crm_leads.edit cannot view', () => {
    expect(hasCeoView([{ section: 'crm_leads', action: 'edit' }])).toBe(false);
  });

  it('Owner Weekly only → hasCeoView true', () => {
    expect(hasCeoView([{ section: 'crm_owner_weekly_dashboard', action: 'view' }])).toBe(true);
  });

  it('NL query can view but not act', () => {
    expect(hasCeoView([{ section: 'ai_analytics', action: 'query' }])).toBe(true);
    expect(hasCeoAct([{ section: 'ai_analytics', action: 'query' }])).toBe(false);
  });

  it('ceo_command.act is required to act', () => {
    expect(hasCeoAct([{ section: 'ceo_command', action: 'act' }])).toBe(true);
  });

  it('configure via ai_admin.configure', () => {
    expect(hasCeoConfigure([{ section: 'ai_admin', action: 'configure' }])).toBe(true);
  });
});
