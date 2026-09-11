import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CmktEIntelligence } from './CmktEIntelligence';

describe('CmktEIntelligence glossary', () => {
  it('lists glossary terms and exposes Approve glossary for Draft rows', () => {
    const html = renderToStaticMarkup(
      createElement(CmktEIntelligence, {
        summary: null,
        scoped: true,
        glossary: [
          {
            id: 11,
            lifecycle_id: 4,
            brand_id: 'brand-4',
            term: 'đăng ký nhận tư vấn',
            locale: 'vi',
            status: 'Draft',
            expires_at: null,
          },
        ],
        canApprove: true,
        onApproveGlossary: async () => undefined,
      }),
    );
    expect(html).toContain('đăng ký nhận tư vấn');
    expect(html).toMatch(/Approve glossary/i);
    expect(html).toMatch(/Copilot không dùng/);
  });

  it('does not invent sample glossary terms when the list is empty', () => {
    const html = renderToStaticMarkup(
      createElement(CmktEIntelligence, {
        summary: { suggestions: ['ok'], top_items: [] },
        scoped: true,
        glossary: [],
      }),
    );
    expect(html).not.toContain('Sunlight');
    expect(html).not.toContain('Nova');
    expect(html).not.toContain('Tâm An');
    expect(html).not.toMatch(/sample term|thuật ngữ mẫu/i);
  });

  it('renders Glossary studio separate from Insight with ＋ Tạo Draft', () => {
    const html = renderToStaticMarkup(
      createElement(CmktEIntelligence, {
        summary: { suggestions: ['ok'], top_items: [] },
        scoped: true,
        glossary: [],
      }),
    );
    expect(html).toContain('Glossary studio');
    expect(html).toContain('＋ Tạo Draft');
    expect(html).toContain('Insight draft');
    expect(html.indexOf('Glossary studio')).toBeGreaterThan(html.indexOf('Insight draft'));
  });
});
