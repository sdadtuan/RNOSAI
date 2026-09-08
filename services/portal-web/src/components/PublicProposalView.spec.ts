import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PUBLIC_ACCEPT_CTA,
  acceptPublicProposal,
  publicHtmlLeaks,
  type PublicProposal,
} from '@/lib/public-proposal';
import { renderPublicProposalViewHtml } from '@/lib/public-proposal-view-html';
import { PublicProposalView } from './PublicProposalView';

const DATA: PublicProposal = {
  quote_code: 'QT-PTT-2026-000089',
  title: 'Growth Proposal Q4/2026',
  objective: 'Lead căn hộ cao cấp',
  audience: 'CFO',
  campaign_period: '2026-Q4',
  valid_until: '2026-10-07',
  version_n: 2,
  status: 'sent',
  kpis: [{ label: 'Lead dự kiến', value: '1.000' }],
  scope: [{ dv_code: 'DV08', notes: 'Meta Ads' }],
  investment: {
    fee_vnd: 100_000_000,
    media_vnd: 20_000_000,
    discount_vnd: 0,
    tax_vnd: 8_000_000,
    payable_vnd: 128_000_000,
  },
  payments: [{ seq: 1, pct_bps: 5000, amount_vnd: 64_000_000, milestone: 'Kickoff' }],
  option_key: 'A',
  options: [
    { option_key: 'A', name: 'Core', client_visible: true, payable_vnd: 128_000_000 },
    { option_key: 'B', name: 'Growth', client_visible: true, payable_vnd: 150_000_000 },
    { option_key: 'C', name: 'Hidden', client_visible: false, payable_vnd: 1 },
  ],
  otp_required: true,
  cta: { accept: PUBLIC_ACCEPT_CTA },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PublicProposalView', () => {
  it('shows visible options + OTP when required and never leaks margin/NSR or contract-sign copy', () => {
    const html = renderPublicProposalViewHtml({
      data: DATA,
      name: 'Minh Anh',
      email: 'minhanh@anphat.vn',
      title: 'MD',
      optionKey: 'B',
      otp: '123456',
      accepted: true,
    });

    expect(html).toContain(PUBLIC_ACCEPT_CTA);
    expect(html).toContain('Growth');
    expect(html).toContain('Core');
    expect(html).not.toContain('Hidden');
    expect(html).toMatch(/otp|OTP|Mã xác nhận/i);
    expect(html).not.toMatch(/ký hợp đồng/i);
    expect(html).not.toContain('265647600');
    expect(publicHtmlLeaks(html)).toEqual([]);
  });

  it('hides OTP fields when otp_required is false and empty money is —', () => {
    const html = renderPublicProposalViewHtml({
      data: {
        ...DATA,
        otp_required: false,
        investment: {
          fee_vnd: null,
          media_vnd: null,
          discount_vnd: null,
          tax_vnd: null,
          payable_vnd: null,
        },
      },
    });
    expect(html).toContain('—');
    expect(html).not.toMatch(/name="otp"|id="otp"|Mã OTP/i);
    expect(publicHtmlLeaks(html)).toEqual([]);
  });

  it('accept B + OTP submits option_key B and otp from the real view fields', async () => {
    const html = renderPublicProposalViewHtml({
      data: DATA,
      name: 'Minh Anh',
      email: 'minhanh@anphat.vn',
      title: 'MD',
      optionKey: 'B',
      otp: '654321',
      accepted: true,
    });
    expect(html).toContain('value="B"');
    expect(html).toContain('654321');
    expect(html).toContain(PUBLIC_ACCEPT_CTA);
    expect(publicHtmlLeaks(html)).toEqual([]);
    expect(PublicProposalView).toBeTypeOf('function');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'accepted', option_key: 'B' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const out = await acceptPublicProposal('share-token', {
      accepted: true,
      name: 'Minh Anh',
      email: 'minhanh@anphat.vn',
      title: 'MD',
      option_key: 'B',
      otp: '654321',
    });
    expect(out.option_key).toBe('B');
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as {
      option_key?: string;
      otp?: string;
    };
    expect(sent.option_key).toBe('B');
    expect(sent.otp).toBe('654321');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/public/proposals/share-token/accept');
  });
});
