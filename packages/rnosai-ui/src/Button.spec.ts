import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders primary md classes by default', () => {
    const html = renderToStaticMarkup(createElement(Button, null, 'Lưu'));
    expect(html).toContain('rn-btn');
    expect(html).toContain('rn-btn--primary');
    expect(html).toContain('rn-btn--md');
    expect(html).toContain('Lưu');
  });

  it('supports secondary + sm', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { variant: 'secondary', size: 'sm' }, 'Huỷ'),
    );
    expect(html).toContain('rn-btn--secondary');
    expect(html).toContain('rn-btn--sm');
  });
});
