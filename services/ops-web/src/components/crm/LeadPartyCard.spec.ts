import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LeadPartyCard } from './LeadPartyCard';

describe('LeadPartyCard', () => {
  it('renders company, contact, address, phone, email, logo (AC-LP-06)', () => {
    const html = renderToStaticMarkup(
      createElement(LeadPartyCard, {
        leadId: 5,
        value: {
          company_name: '360 Auto Detailing',
          company_address: '12 Nguyễn Huệ',
          phone: '0901234567',
          email: 'am@360auto.vn',
          logo_asset_id: 'logo-1',
          full_name: 'Tuan Truong',
        },
        onChange: () => {},
        quoteHref: '/crm/proposals/12',
      }),
    );

    expect(html).toContain('Thông tin khách');
    expect(html).toContain('360 Auto Detailing');
    expect(html).toContain('Tuan Truong');
    expect(html).toContain('12 Nguyễn Huệ');
    expect(html).toContain('0901234567');
    expect(html).toContain('am@360auto.vn');
    expect(html).toContain('name="company_name"');
    expect(html).toContain('Mở báo giá');
    expect(html).not.toContain('agency_client_id');
  });
});
