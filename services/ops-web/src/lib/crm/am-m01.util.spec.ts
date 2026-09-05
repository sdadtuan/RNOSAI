import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  amM01MailtoHref,
  amM01NearestEndsOn,
  amM01RulesOnlyInMax767,
  amM01TelHref,
  amM01ZaloHref,
  stripMaxWidth767Media,
} from './am-m01.util';

const AM_CSS = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../app/crm/account-management/am.css'),
  'utf8',
);

describe('am-m01 CSS', () => {
  it('keeps .am-m01 rules only inside @media (max-width: 767px)', () => {
    expect(amM01RulesOnlyInMax767(AM_CSS)).toBe(true);
    expect(AM_CSS).toMatch(/@media\s*\(\s*max-width:\s*767px\s*\)/);
    expect(AM_CSS).toMatch(/\.am-m01\s*\{/);
  });

  it('hides settings, reports, admin, and am-m01-hide only under 767px', () => {
    expect(amM01RulesOnlyInMax767(AM_CSS)).toBe(true);
    const outside = stripMaxWidth767Media(AM_CSS);
    expect(outside).not.toMatch(/\.am-m01-hide\b/);
    expect(outside).not.toMatch(/\.am-m01-admin\b/);
    expect(AM_CSS).toMatch(/@media\s*\(\s*max-width:\s*767px\s*\)[\s\S]*\.am-m01-hide/);
    expect(AM_CSS).toMatch(/@media\s*\(\s*max-width:\s*767px\s*\)[\s\S]*href\$="\/settings"/);
    expect(AM_CSS).toMatch(/@media\s*\(\s*max-width:\s*767px\s*\)[\s\S]*href\$="\/reports"/);
    expect(AM_CSS).toMatch(/@media\s*\(\s*max-width:\s*767px\s*\)[\s\S]*\.am-m01-admin/);
  });
});

describe('amM01 contact hrefs', () => {
  it('builds tel, mailto, and zalo.me links from existing fields', () => {
    expect(amM01TelHref('0901 234 567')).toBe('tel:0901234567');
    expect(amM01TelHref(null)).toBe(null);
    expect(amM01MailtoHref('am@pttads.vn')).toBe('mailto:am@pttads.vn');
    expect(amM01MailtoHref('  ')).toBe(null);
    expect(amM01ZaloHref('0901 234 567')).toBe('https://zalo.me/0901234567');
    expect(amM01ZaloHref(undefined)).toBe(null);
  });
});

describe('amM01NearestEndsOn', () => {
  it('returns the soonest ends_on or null — never invents a date', () => {
    expect(
      amM01NearestEndsOn([
        { ends_on: '2027-01-01' },
        { ends_on: '2026-10-01' },
        { ends_on: null },
      ]),
    ).toBe('2026-10-01');
    expect(amM01NearestEndsOn([])).toBe(null);
    expect(amM01NearestEndsOn([{ ends_on: null }])).toBe(null);
  });
});
