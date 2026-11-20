import { defaultCanReceiveSolution } from './default-can-receive-solution.util';

describe('defaultCanReceiveSolution', () => {
  it('returns explicit true or false over position', () => {
    expect(defaultCanReceiveSolution({ positionCode: 'ae', explicit: true })).toBe(true);
    expect(defaultCanReceiveSolution({ positionCode: 'acm', explicit: false })).toBe(false);
  });

  it('defaults AM codes to true and others to false', () => {
    expect(defaultCanReceiveSolution({ positionCode: 'ACM' })).toBe(true);
    expect(defaultCanReceiveSolution({ positionCode: 'KD-01' })).toBe(true);
    expect(defaultCanReceiveSolution({ positionCode: 'kd01' })).toBe(true);
    expect(defaultCanReceiveSolution({ positionCode: 'AE' })).toBe(false);
    expect(defaultCanReceiveSolution({ positionCode: 'MKL' })).toBe(false);
    expect(defaultCanReceiveSolution({ positionCode: 'mkt-01' })).toBe(false);
  });
});