import { describe, expect, it } from 'vitest';
import {
  PUBLIC_ACCEPT_CTA,
  buildPublicAcceptBody,
  formatPublicMoney,
  isGonePublicProposal,
  publicHtmlLeaks,
  publicProposalNeedsOtp,
  visiblePublicOptions,
} from './public-proposal';

describe('public-proposal helper', () => {
  it('CTA is Xác nhận đề xuất and never contract-sign copy', () => {
    expect(PUBLIC_ACCEPT_CTA).toBe('Xác nhận đề xuất');
    expect(PUBLIC_ACCEPT_CTA).not.toMatch(/ký hợp đồng/i);
  });

  it('formats missing money as em dash and never invents 0 or sample 265.647.600', () => {
    expect(formatPublicMoney(null)).toBe('—');
    expect(formatPublicMoney(undefined)).toBe('—');
    expect(formatPublicMoney(128_000_000)).toMatch(/128/);
    expect(formatPublicMoney(null)).not.toBe('0');
    expect(String(formatPublicMoney(128_000_000))).not.toMatch(/265\.?647\.?600/);
  });

  it('treats HTTP 410 as expired / revoked portal state', () => {
    expect(isGonePublicProposal({ status: 410 })).toBe(true);
    expect(isGonePublicProposal({ status: 404 })).toBe(false);
  });

  it('option picker keeps visible options only and OTP follows otp_required', () => {
    const options = visiblePublicOptions({
      quote_code: null,
      title: 'Growth',
      objective: '',
      audience: '',
      campaign_period: '',
      valid_until: null,
      version_n: 1,
      status: 'sent',
      kpis: [],
      scope: [],
      investment: {
        fee_vnd: null,
        media_vnd: null,
        discount_vnd: null,
        tax_vnd: null,
        payable_vnd: null,
      },
      payments: [],
      option_key: 'A',
      cta: { accept: PUBLIC_ACCEPT_CTA },
      options: [
        { option_key: 'A', name: 'Core', client_visible: true },
        { option_key: 'B', name: 'Growth', client_visible: true },
        { option_key: 'C', name: 'Hidden', client_visible: false },
      ],
      otp_required: true,
    });
    expect(options.map((row) => row.option_key)).toEqual(['A', 'B']);
    expect(publicProposalNeedsOtp({ otp_required: true } as never)).toBe(true);
    expect(publicProposalNeedsOtp({ otp_required: false } as never)).toBe(false);
    expect(
      buildPublicAcceptBody({
        accepted: true,
        name: 'Minh Anh',
        email: 'minhanh@anphat.vn',
        title: 'MD',
        option_key: 'B',
        otp: '123456',
      }),
    ).toEqual({
      accepted: true,
      name: 'Minh Anh',
      email: 'minhanh@anphat.vn',
      title: 'MD',
      option_key: 'B',
      otp: '123456',
    });
  });

  it('public HTML leak helper fails when margin or NSR appear', () => {
    expect(publicHtmlLeaks('<article>Tổng · 128.000.000 ₫</article>')).toEqual([]);
    expect(publicHtmlLeaks('<p>Gross margin 22%</p>')).toContain('margin');
    expect(publicHtmlLeaks('<p>NSR 100.000.000</p>')).toContain('NSR');
  });
});
