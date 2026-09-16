import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';
import { Chip } from './Chip';
import { Input } from './Input';
import { Select } from './Select';

describe('field + card primitives', () => {
  it('Input marks error', () => {
    const html = renderToStaticMarkup(createElement(Input, { error: true, 'aria-label': 'q' }));
    expect(html).toContain('rn-input');
    expect(html).toContain('rn-input--error');
  });

  it('Select marks error', () => {
    const html = renderToStaticMarkup(
      createElement(Select, { error: true, 'aria-label': 's' }, createElement('option', null, 'A')),
    );
    expect(html).toContain('rn-select--error');
  });

  it('Chip active', () => {
    const html = renderToStaticMarkup(createElement(Chip, { active: true }, 'Tất cả'));
    expect(html).toContain('rn-chip--active');
  });

  it('Card wraps children', () => {
    const html = renderToStaticMarkup(createElement(Card, null, 'body'));
    expect(html).toContain('rn-card');
    expect(html).toContain('body');
  });
});
