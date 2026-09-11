import { BadRequestException } from '@nestjs/common';
import { assertHumanConfirm, assertExecuteGate } from './publication-execute.util';

describe('assertHumanConfirm', () => {
  it('rejects missing confirm', () => {
    try {
      assertHumanConfirm(false);
      throw new Error('expected');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'human_confirm_required' });
    }
  });
});

describe('assertExecuteGate', () => {
  it('blocks Blocked and allows Pass/Warning', () => {
    expect(() => assertExecuteGate('Pass')).not.toThrow();
    expect(() => assertExecuteGate('Warning')).not.toThrow();
    expect(() => assertExecuteGate('Blocked')).toThrow(BadRequestException);
  });
});
