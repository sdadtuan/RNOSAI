import { NotFoundException } from '@nestjs/common';
import { throwDisabled } from './msos-errors.util';

describe('throwDisabled', () => {
  it('throws NotFoundException with media_os_disabled', () => {
    expect(() => throwDisabled()).toThrow(NotFoundException);
    try {
      throwDisabled();
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundException);
      expect((e as NotFoundException).getResponse()).toEqual({ error: 'media_os_disabled' });
    }
  });
});
