import { PUBLIC_ACCEPT_CTA } from '../src/lib/public-proposal';
import { renderPublicProposalViewHtml } from '../src/lib/public-proposal-view-html';

const html = renderPublicProposalViewHtml({
  data: {
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
      { option_key: 'A', name: 'Core', client_visible: true },
      { option_key: 'B', name: 'Growth', client_visible: true },
    ],
    otp_required: true,
    cta: { accept: PUBLIC_ACCEPT_CTA },
  },
  name: 'Minh Anh',
  email: 'minhanh@anphat.vn',
  title: 'MD',
  optionKey: 'B',
  otp: '654321',
  accepted: true,
});

process.stdout.write(html);
