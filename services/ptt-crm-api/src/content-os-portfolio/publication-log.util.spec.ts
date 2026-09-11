import { BadRequestException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { nextPublicationRetryN, publicationLogFromError } from './publication-log.util';

describe('nextPublicationRetryN', () => {
  it('starts at 1 when the item has no prior attempts', () => {
    expect(nextPublicationRetryN(null)).toBe(1);
    expect(nextPublicationRetryN(undefined)).toBe(1);
    expect(nextPublicationRetryN(0)).toBe(1);
  });

  it('increments the max retry_n for the item', () => {
    expect(nextPublicationRetryN(1)).toBe(2);
    expect(nextPublicationRetryN(4)).toBe(5);
  });
});

describe('publicationLogFromError', () => {
  it('maps ConflictException publish_gate_blocked to 409 and the error code', () => {
    const err = new ConflictException({ error: 'publish_gate_blocked', blockers: [] });
    expect(publicationLogFromError(err)).toEqual({
      error: 'publish_gate_blocked',
      http_status: 409,
    });
  });

  it('maps BadRequest invalid_transition to 400 and the error code', () => {
    const err = new BadRequestException({ error: 'invalid_transition', action: 'publish' });
    expect(publicationLogFromError(err)).toEqual({
      error: 'invalid_transition',
      http_status: 400,
    });
  });

  it('maps generic 5xx HttpException to status and message', () => {
    const err = new HttpException('upstream_failed', HttpStatus.BAD_GATEWAY);
    expect(publicationLogFromError(err)).toEqual({
      error: 'upstream_failed',
      http_status: 502,
    });
  });
});
