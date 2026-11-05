import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  QT_CREATE_SOURCES,
  QtCreateFields,
  QtSourceCards,
  buildQuoteCreateRequest,
  prefillFromSearch,
  resolveAgencyClientFromLead,
} from './QtCreateForm';

describe('QtCreateForm markup', () => {
  it('uses named selects for lead and client and never a UUID text input', () => {
    const html = renderToStaticMarkup(
      createElement(QtCreateFields, {
        source: 'lead',
        leadId: '12',
        agencyClientId: '11111111-1111-4111-8111-111111111111',
        customerId: '3',
        title: 'Growth Q4',
        quoteType: 'new_business',
        leads: [{ id: 12, full_name: 'An Phát', client_id: '11111111-1111-4111-8111-111111111111' }],
        clients: [{ agency_client_id: '11111111-1111-4111-8111-111111111111', name: 'Công ty An Phát' }],
        onLeadChange: () => {},
        onClientChange: () => {},
        onTitleChange: () => {},
        onQuoteTypeChange: () => {},
      }),
    );

    expect(html).toMatch(/<select[^>]*name="lead_id"/);
    expect(html).toMatch(/<select[^>]*name="agency_client_id"/);
    expect(html).not.toMatch(/<input[^>]*name="agency_client_id"/);
    expect(html).not.toMatch(/<input[^>]*name="lead_id"/);
    expect(html).toContain('Công ty An Phát');
    expect(html).toContain('LD-12');
    expect(html).toContain('Đã có trên AM 360 (upsell)');
    expect(html).not.toContain('Khách (AM 360) *');
    expect(html).not.toContain('<main');
    expect(html).not.toContain('NOVA');
    expect(html).not.toContain('265.647.600');
  });

  it('AC-LP-08: lead source shows party card and never a UUID text input', () => {
    const html = renderToStaticMarkup(
      createElement(QtCreateFields, {
        source: 'lead',
        leadId: '5',
        agencyClientId: '',
        customerId: '',
        title: '360 Auto Q1',
        quoteType: 'new_business',
        leads: [{ id: 5, full_name: 'Tuan Truong', company_name: '360 Auto Detailing' }],
        clients: [],
        party: {
          company_name: '360 Auto Detailing',
          company_address: '',
          phone: '0901',
          email: '',
          logo_asset_id: '',
          full_name: 'Tuan Truong',
        },
        onLeadChange: () => {},
        onClientChange: () => {},
        onTitleChange: () => {},
        onQuoteTypeChange: () => {},
        onPartyChange: () => {},
      }),
    );

    expect(html).toContain('Thông tin khách');
    expect(html).toContain('name="company_name"');
    expect(html).toContain('360 Auto Detailing');
    expect(html).not.toMatch(/<input[^>]*name="agency_client_id"/);
    expect(html).not.toMatch(/<input[^>]*name="lead_id"/);
  });

  it('renders three source cards lead | am360 | blank', () => {
    expect(QT_CREATE_SOURCES.map((card) => card.id)).toEqual(['lead', 'am360', 'blank']);
    const html = renderToStaticMarkup(
      createElement(QtSourceCards, { source: 'lead', onChange: () => {} }),
    );
    expect(html).toContain('Từ Lead / Deal Room');
    expect(html).toContain('Từ AM 360');
    expect(html).toContain('Trống');
    expect(html).toContain('qt-source');
  });
});

describe('create from lead', () => {
  it('sends source lead, lead_id, and Idempotency-Key', () => {
    const req = buildQuoteCreateRequest({
      source: 'lead',
      leadId: '12',
      agencyClientId: '11111111-1111-4111-8111-111111111111',
      customerId: '3',
      title: 'An Phát Q3',
      quoteType: 'new_business',
      idempotencyKey: 'qt-lead-12',
    });

    expect(req.body).toEqual({
      source: 'lead',
      lead_id: 12,
      agency_client_id: '11111111-1111-4111-8111-111111111111',
      customer_id: 3,
      title: 'An Phát Q3',
      quote_type: 'new_business',
    });
    expect(req.headers['Idempotency-Key']).toBe('qt-lead-12');
  });

  it('AC-LP-01: lead source omits agency_client_id when empty and sends lead_party', () => {
    const req = buildQuoteCreateRequest({
      source: 'lead',
      leadId: '5',
      agencyClientId: '',
      customerId: '',
      title: '360 Auto Q1',
      quoteType: 'new_business',
      idempotencyKey: 'qt-lead-5',
      party: {
        company_name: '360 Auto Detailing',
        company_address: '12 Nguyễn Huệ',
        phone: '0901234567',
        email: '',
        logo_asset_id: '',
        full_name: 'Tuan Truong',
      },
    });

    expect(req.body).toEqual({
      source: 'lead',
      lead_id: 5,
      title: '360 Auto Q1',
      quote_type: 'new_business',
      lead_party: {
        company_name: '360 Auto Detailing',
        company_address: '12 Nguyễn Huệ',
        phone: '0901234567',
        email: '',
        logo_asset_id: null,
      },
    });
    expect(req.body).not.toHaveProperty('agency_client_id');
  });

  it('prefills lead / customer / agency client from Deal Room query', () => {
    expect(
      prefillFromSearch(
        new URLSearchParams(
          'lead_id=12&customer_id=3&agency_client_id=11111111-1111-4111-8111-111111111111&wizard=1',
        ),
      ),
    ).toEqual({
      source: 'lead',
      leadId: '12',
      customerId: '3',
      agencyClientId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('prefills named client select from lead.client_id when URL has only lead_id', () => {
    const clientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const prefill = prefillFromSearch(new URLSearchParams('lead_id=12'));
    const leads = [{ id: 12, full_name: 'An Phát', client_id: clientId }];
    const agencyClientId = resolveAgencyClientFromLead({
      leadId: prefill.leadId,
      leads,
      urlAgencyClientId: prefill.agencyClientId,
    });

    expect(prefill.agencyClientId).toBe('');
    expect(agencyClientId).toBe(clientId);

    const html = renderToStaticMarkup(
      createElement(QtCreateFields, {
        source: 'lead',
        leadId: prefill.leadId,
        agencyClientId,
        customerId: prefill.customerId,
        title: '',
        quoteType: 'new_business',
        leads,
        clients: [{ agency_client_id: clientId, name: 'Công ty An Phát' }],
        onLeadChange: () => {},
        onClientChange: () => {},
        onTitleChange: () => {},
        onQuoteTypeChange: () => {},
      }),
    );

    expect(html).toMatch(/<select[^>]*name="agency_client_id"/);
    expect(html).toMatch(
      new RegExp(`<option[^>]*value="${clientId}"[^>]*selected|<option[^>]*selected[^>]*value="${clientId}"`),
    );
    expect(html).not.toMatch(/<input[^>]*name="agency_client_id"/);
  });

  it('keeps URL agency_client_id when Deal Room already supplied it', () => {
    const urlClient = '11111111-1111-4111-8111-111111111111';
    expect(
      resolveAgencyClientFromLead({
        leadId: '12',
        leads: [{ id: 12, full_name: 'An Phát', client_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
        urlAgencyClientId: urlClient,
      }),
    ).toBe(urlClient);
  });
});
