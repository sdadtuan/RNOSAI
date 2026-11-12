import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LeadPipelinePresalesPanel } from './LeadPipelinePresalesPanel';
import type { LeadFunnelSnapshot } from '@/lib/api';

function funnel(stage: string, slug: string): LeadFunnelSnapshot {
  return {
    presales: {
      presales: { id: 1, stage, service_slug: slug, status: 'active' },
      tasks: {},
      advance: { can_advance_forward: false, block_reason: '', next_stage: '' },
    },
  } as LeadFunnelSnapshot;
}

describe('LeadPipelinePresalesPanel labels', () => {
  it('shows Vietnamese stage and service display name, never raw slugs or enum codes', () => {
    const html = renderToStaticMarkup(
      createElement(LeadPipelinePresalesPanel, {
        funnel: funnel('proposal', 'dich-vu-seo-tong-the'),
        canEdit: false,
        busy: false,
        selectedServiceSlug: 'dich-vu-seo-tong-the',
        serviceOptions: [{ slug: 'dich-vu-seo-tong-the', name: 'SEO tổng thể' }],
        intakeHref: '/intake',
        onServiceChange: () => {},
        onStartPresales: () => {},
        tasks: null,
        r5Form: null,
        stage: 'proposal',
      }),
    );

    expect(html).toContain('Giai đoạn');
    expect(html).toContain('Báo giá');
    expect(html).toContain('SEO tổng thể');
    expect(html).not.toContain('>proposal<');
    expect(html).not.toContain('dich-vu-seo-tong-the');
  });

  it('does not put the raw slug in the service picker visible label', () => {
    const html = renderToStaticMarkup(
      createElement(LeadPipelinePresalesPanel, {
        funnel: { presales: null } as LeadFunnelSnapshot,
        canEdit: true,
        busy: false,
        selectedServiceSlug: 'dich-vu-seo-tong-the',
        serviceOptions: [{ slug: 'dich-vu-seo-tong-the', name: 'SEO tổng thể' }],
        intakeHref: '/intake',
        onServiceChange: () => {},
        onStartPresales: () => {},
        tasks: null,
        r5Form: null,
        stage: 'lead',
      }),
    );
    expect(html).toContain('SEO tổng thể');
    expect(html).not.toContain('SEO tổng thể (dich-vu-seo-tong-the)');
  });
});

