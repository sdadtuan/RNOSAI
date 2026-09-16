import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StatCard } from './StatCard';
import { Table } from './Table';
import { Tabs } from './Tabs';

describe('Tabs StatCard Table', () => {
  it('Tabs marks active item', () => {
    const html = renderToStaticMarkup(
      createElement(Tabs, {
        items: [
          { id: 'kanban', label: 'Kanban' },
          { id: 'list', label: 'Danh sách' },
        ],
        value: 'list',
        onChange: vi.fn(),
      }),
    );
    expect(html).toContain('rn-tabs');
    expect(html).toContain('rn-tabs__tab--active');
    expect(html).toContain('Danh sách');
  });

  it('StatCard accent class', () => {
    const html = renderToStaticMarkup(
      createElement(StatCard, { value: '3', label: 'Nóng', accent: 'hot' }),
    );
    expect(html).toContain('rn-stat-card--hot');
    expect(html).toContain('3');
  });

  it('Table sets rn-table', () => {
    const html = renderToStaticMarkup(
      createElement(
        Table,
        null,
        createElement('thead', null, createElement('tr', null, createElement('th', null, 'ID'))),
      ),
    );
    expect(html).toContain('rn-table');
    expect(html).toContain('ID');
  });
});
