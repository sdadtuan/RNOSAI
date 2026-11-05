import {
  formatContentRequestCode,
  formatContentItemCode,
  requestCompleteness,
} from './content-os-portfolio.util';

describe('display codes', () => {
  it('formats immutable CR/CNT', () => {
    const d = new Date('2026-09-10T07:00:00+07:00');
    expect(formatContentRequestCode(d, 24)).toBe('CR-20260910-024');
    expect(formatContentItemCode(d, 21)).toBe('CNT-20260910-021');
  });
});

describe('requestCompleteness', () => {
  it('returns 0 when all empty', () => {
    expect(requestCompleteness({
      client: '', brand: '', deliverable: '', objective: '', due: '', source: '',
    })).toBe(0);
  });
  it('returns 100 when required filled', () => {
    expect(requestCompleteness({
      client: 'A', brand: 'B', deliverable: '12 posts', objective: 'Lead', due: '2026-09-20', source: 'account',
    })).toBe(100);
  });
});
