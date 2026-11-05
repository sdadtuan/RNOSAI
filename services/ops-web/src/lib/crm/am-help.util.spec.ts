import { describe, expect, it } from 'vitest';
import { AM_HELP_LINKS, amHelpTitle } from './am-help.util';

describe('amHelpTitle', () => {
  it('lists five in-app SOP links and no portal/ads', () => {
    expect(amHelpTitle()).toMatch(/Account Management/i);
    expect(AM_HELP_LINKS).toHaveLength(5);
    expect(AM_HELP_LINKS.some((l) => /portal|ads/i.test(`${l.href} ${l.label}`))).toBe(false);
  });
});
