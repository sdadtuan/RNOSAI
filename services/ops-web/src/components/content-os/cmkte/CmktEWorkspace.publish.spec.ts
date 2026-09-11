import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CmktEPublishPanel } from './CmktEWorkspace';

describe('CmktEWorkspace publish', () => {
  it('always shows Mark published and hides Đăng lên Page unless showDangLenPage', () => {
    const hidden = renderToStaticMarkup(
      createElement(CmktEPublishPanel, {
        showDangLenPage: false,
        gateStatus: 'Pass',
        pageName: 'PTT Ads',
        caption: 'Locked caption',
      }),
    );
    expect(hidden).toContain('Mark published');
    expect(hidden).toContain('Đăng / Mark published');
    expect(hidden).not.toContain('Đăng lên Page');
    expect(hidden).not.toMatch(/Instagram — E5|Website CMS — E6/);

    const shown = renderToStaticMarkup(
      createElement(CmktEPublishPanel, {
        showDangLenPage: true,
        gateStatus: 'Pass',
        pageName: 'PTT Ads',
        caption: 'Locked caption',
        sticky: true,
      }),
    );
    expect(shown).toContain('Mark published');
    expect(shown).toContain('Đăng lên Page');
    expect(shown).toContain('Đăng / Mark published');
    expect(shown).toContain('Tôi xác nhận đăng với tư cách Page này. AI không được xác nhận.');
    expect(shown).toContain('PTT Ads');
    expect(shown).toContain('Locked caption');
  });

  it('does not invent publication evidence', () => {
    const html = renderToStaticMarkup(
      createElement(CmktEPublishPanel, {
        showDangLenPage: true,
        gateStatus: 'Pass',
        pageName: 'PTT Ads',
        caption: 'Locked caption',
        evidence: { post_id: '1234567890', permalink: 'https://facebook.com/555/posts/1234567890' },
      }),
    );
    expect(html).toContain('1234567890');
    expect(html).toContain('https://facebook.com/555/posts/1234567890');
    expect(html).not.toContain('facebook.com/fake');
  });

  it('hides the execute button on 403 instead of rendering a dead form', () => {
    const html = renderToStaticMarkup(
      createElement(CmktEPublishPanel, {
        showDangLenPage: false,
        executeForbidden: true,
        gateStatus: 'Pass',
        pageName: 'PTT Ads',
        caption: 'Locked caption',
      }),
    );
    expect(html).toContain('Mark published');
    expect(html).not.toContain('Đăng lên Page');
    expect(html).not.toContain('Xác nhận và đăng');
  });
});
