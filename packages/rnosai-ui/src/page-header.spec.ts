import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Breadcrumb } from './Breadcrumb';
import { PageHeader } from './PageHeader';

describe('PageHeader + Breadcrumb', () => {
  it('Breadcrumb renders separators and link', () => {
    const html = renderToStaticMarkup(
      createElement(Breadcrumb, {
        items: [
          { label: 'CRM', href: '/crm' },
          { label: 'Tickets' },
        ],
      }),
    );
    expect(html).toContain('rn-breadcrumb');
    expect(html).toContain('href="/crm"');
    expect(html).toContain('Tickets');
  });

  it('PageHeader renders title and actions slot', () => {
    const html = renderToStaticMarkup(
      createElement(PageHeader, {
        title: 'Ticket',
        subtitle: 'CSD',
        actions: createElement('button', { type: 'button' }, 'Tạo'),
      }),
    );
    expect(html).toContain('rn-page-header');
    expect(html).toContain('Ticket');
    expect(html).toContain('CSD');
    expect(html).toContain('Tạo');
  });
});
