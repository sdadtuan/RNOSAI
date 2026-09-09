import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PmQualityChip } from './PmQualityChip';

describe('PmQualityChip', () => {
  it('renders Stale not Verified', () => {
    expect(renderToStaticMarkup(createElement(PmQualityChip, { quality: 'stale' }))).toContain('Stale');
    expect(renderToStaticMarkup(createElement(PmQualityChip, { quality: 'verified' }))).toContain('Verified');
  });
});
