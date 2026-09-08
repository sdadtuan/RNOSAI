import { describe, expect, it } from 'vitest';
import {
  PUBLIC_ACCEPT_CTA,
  formatPublicMoney,
  isGonePublicProposal,
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
});
