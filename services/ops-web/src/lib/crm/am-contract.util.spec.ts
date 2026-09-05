import { describe, expect, it } from 'vitest';
import { AM_CONTRACT_TABS, amContractAmountDisplay, parseAmContractTab } from './am-contract.util';

describe('am-contract', () => {
  it('uses the seven contract tab labels', () => {
    expect(AM_CONTRACT_TABS.map((tab) => tab.label)).toEqual([
      'Tổng quan',
      'Dịch vụ & giá',
      'Lịch thanh toán',
      'Gia hạn',
      'Phụ lục',
      'Tài liệu',
      'Audit',
    ]);
  });

  it('parses contract tab from URL or defaults to overview', () => {
    expect(parseAmContractTab('services')).toBe('services');
    expect(parseAmContractTab('payments')).toBe('payments');
    expect(parseAmContractTab('unknown')).toBe('overview');
    expect(parseAmContractTab(null)).toBe('overview');
  });

  it('shows em dash when hide_amounts or amount is null', () => {
    expect(amContractAmountDisplay(true, 1_020_000_000)).toBe('—');
    expect(amContractAmountDisplay(false, null)).toBe('—');
    expect(amContractAmountDisplay(true, null)).toBe('—');
    expect(amContractAmountDisplay(false, 1_020_000_000)).not.toBe('—');
  });
});
