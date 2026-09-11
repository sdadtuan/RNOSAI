import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CmktELegalHoldBadge } from './CmktEWorkspace';

describe('CmktEWorkspace legal hold badge', () => {
  it('renders LEGAL HOLD on H1 when held and never a delete control', () => {
    const on = renderToStaticMarkup(createElement(CmktELegalHoldBadge, { legalHold: true }));
    expect(on).toContain('LEGAL HOLD');
    expect(on).not.toMatch(/>\s*DELETE\s*</i);
    expect(on).not.toMatch(/>\s*Xóa\s*</);

    const off = renderToStaticMarkup(createElement(CmktELegalHoldBadge, { legalHold: false }));
    expect(off).not.toContain('LEGAL HOLD');
  });
});
