import { BadRequestException } from '@nestjs/common';
import { assertInternalEmailRecipients, parseInternalEmailDomains } from './iwr-email.util';

describe('assertInternalEmailRecipients', () => {
  it('allows @pttads.vn', () => {
    expect(() => assertInternalEmailRecipients(['a@pttads.vn'], ['pttads.vn'])).not.toThrow();
  });

  it('rejects external gmail', () => {
    expect(() => assertInternalEmailRecipients(['user@gmail.com'], ['pttads.vn'])).toThrow(
      BadRequestException,
    );
  });

  it('parses env domains', () => {
    expect(parseInternalEmailDomains('pttads.vn,example.com')).toEqual(['pttads.vn', 'example.com']);
  });
});
