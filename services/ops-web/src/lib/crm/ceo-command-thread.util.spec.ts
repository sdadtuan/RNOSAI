import { describe, expect, it } from 'vitest';
import { canSeeCeoNav, ceoBadge, parseCards } from './ceo-command-thread.util';

describe('ceo-command-thread.util', () => {
  it('AM cannot see nav', () => {
    expect(
      canSeeCeoNav({
        caps: [{ section: 'crm_leads', action: 'edit' }],
      } as never),
    ).toBe(false);
  });

  it('Owner Weekly only → canSeeCeoNav true', () => {
    expect(
      canSeeCeoNav({
        caps: [{ section: 'crm_owner_weekly_dashboard', action: 'view' }],
      } as never),
    ).toBe(true);
  });

  it('ceoBadge OSS when llm on and not stub', () => {
    expect(ceoBadge({ llmEnabled: true, stubMode: false })).toBe('OSS');
  });

  it('parseCards skips malformed', () => {
    expect(parseCards([{ title: 'x' }, { title: 'ok', href: '/a', severity: 'red' }])).toHaveLength(1);
  });
});
