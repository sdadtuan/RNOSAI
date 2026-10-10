import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PresalesConsultPlanScreen } from '@/components/PresalesConsultPlanScreen';
import type { LeadFunnelSnapshot } from '@/lib/api';

const funnel = {
  presales: { tasks: { lead: [], consult: [] } },
} as unknown as LeadFunnelSnapshot;

describe('PresalesConsultPlanScreen', () => {
  it('shows the one-screen plan form before the brief loads', () => {
    const html = renderToStaticMarkup(
      createElement(PresalesConsultPlanScreen, {
        token: 'token',
        leadId: 7,
        funnel,
        canEdit: true,
        canAiDraft: true,
        onFunnelChange: () => undefined,
      }),
    );
    expect(html).toContain('AI viết kế hoạch');
    expect(html).toContain('Điểm khác biệt');
    expect(html).toContain('AI gợi ý lại');
    expect(html).toContain('Facebook Ads');
    expect(html).toContain('Cách chốt đơn');
    expect(html).toContain('Thêm cho file');
    expect(html).not.toContain('Chỉnh sửa trên Tổng quan');
    expect(html).not.toContain('Gửi email');
    expect(html).not.toContain('market_message');
  });
});
