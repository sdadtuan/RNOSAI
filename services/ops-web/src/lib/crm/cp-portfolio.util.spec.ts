import { describe, expect, it } from 'vitest';
import {
  PORTFOLIO_STATUS_CHIPS,
  formatCreditPct,
  formatDeliverableCount,
  formatPortfolioChip,
  portfolioStatusLabel,
  portfolioStatusTone,
} from './cp-portfolio.util';

describe('PRJ-01 portfolio display', () => {
  it('keeps mockup chips Tất cả / Active / At Risk / In Review / Của tôi', () => {
    expect(PORTFOLIO_STATUS_CHIPS.map((chip) => chip.label)).toEqual([
      'Tất cả',
      'Active',
      'At Risk',
      'In Review',
      'Của tôi',
    ]);
  });

  it('renders deliverable and credit like the mockup, or — when empty', () => {
    expect(formatDeliverableCount(8, 13)).toBe('8 / 13');
    expect(formatDeliverableCount(0, 0)).toBe('—');
    expect(formatDeliverableCount(null, null)).toBe('—');
    expect(formatCreditPct(1280, 1600)).toBe('80%');
    expect(formatCreditPct(0, null)).toBe('—');
    expect(formatCreditPct(null, 0)).toBe('—');
  });

  it('maps status to mockup pill tone and label', () => {
    expect(portfolioStatusTone('active')).toBe('ok');
    expect(portfolioStatusTone('at_risk')).toBe('warn');
    expect(portfolioStatusTone('in_review')).toBe('info');
    expect(portfolioStatusTone('draft')).toBe('info');
    expect(portfolioStatusLabel('at_risk')).toBe('At Risk');
    expect(portfolioStatusLabel(null)).toBe('—');
  });

  it('prints chip counts from summary, never inventing a mockup 12', () => {
    expect(formatPortfolioChip('all', { all: 1, active: 1, at_risk: 0, in_review: 0 })).toBe(
      'Tất cả (1)',
    );
    expect(formatPortfolioChip('active', { all: 1, active: 1, at_risk: 0, in_review: 0 })).toBe(
      'Active (1)',
    );
  });
});
