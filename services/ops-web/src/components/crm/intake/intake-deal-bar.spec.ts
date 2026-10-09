import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IntakeDealBar } from '@/components/crm/intake/IntakeDealBar';

describe('IntakeDealBar catalogs', () => {
  it('lets AE pick industry and service from system lists', () => {
    const html = renderToStaticMarkup(
      createElement(IntakeDealBar, {
        leadName: 'Nguyễn Huân',
        companyName: null,
        industry: null,
        industrySlug: '',
        industryOptions: [{ slug: 'spa', name: 'Spa' }],
        serviceSlug: 'dich-vu-seo-tong-the',
        serviceLabel: 'SEO tổng thể',
        serviceOptions: [{ slug: 'dich-vu-seo-tong-the', name: 'SEO tổng thể' }],
        bantTotal: 0,
        winTotal: 0,
        gap: 24,
        stage: 'lead',
        sciExcerpt: null,
        leadHref: '/crm/leads/1',
        cockpitHref: '/crm/leads/1',
        canEdit: true,
        slugMismatch: false,
        funnelCollapsed: true,
        onToggleFunnel: () => undefined,
        onServiceChange: () => undefined,
        onIndustryChange: () => undefined,
      }),
    );
    expect(html).toContain('aria-label="Ngành"');
    expect(html).toContain('Spa');
    expect(html).toContain('SEO tổng thể');
    expect(html).toContain('Chưa có ngành');
  });
});
