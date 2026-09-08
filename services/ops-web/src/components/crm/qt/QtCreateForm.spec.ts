import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  QT_CREATE_SOURCES,
  QtCreateFields,
  QtSourceCards,
  buildQuoteCreateRequest,
  prefillFromSearch,
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
    expect(html).not.toContain('<main');
    expect(html).not.toContain('NOVA');
    expect(html).not.toContain('265.647.600');
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
});
