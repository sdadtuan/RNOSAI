import { BadRequestException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import {
  PUBLICATION_LOG_INSERT_SQL,
  insertPublicationLogWithRetry,
  isPublicationRetryNCollision,
  nextPublicationRetryN,
  publicationLogFromError,
} from './publication-log.util';

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

describe('publication log insert allocation', () => {
  it('assigns retry_n in the same INSERT as COALESCE(MAX(retry_n),0)+1 for the item', () => {
    expect(PUBLICATION_LOG_INSERT_SQL).toMatch(
      /COALESCE\(\(SELECT MAX\(retry_n\) FROM cmkt_publication_logs WHERE item_id = \$1\), 0\) \+ 1/,
    );
    expect(PUBLICATION_LOG_INSERT_SQL).toMatch(/INSERT INTO cmkt_publication_logs/);
  });

  it('retries a unique retry_n collision and does not treat it as a successful skip', async () => {
    let attempts = 0;
    const row = await insertPublicationLogWithRetry(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: '23505',
          constraint: 'cmkt_publication_logs_item_retry_uq',
        });
      }
      return { id: 2, retry_n: 2 };
    });
    expect(attempts).toBe(2);
    expect(row).toEqual({ id: 2, retry_n: 2 });
  });

  it('does not swallow a non-collision insert failure as success', async () => {
    await expect(
      insertPublicationLogWithRetry(async () => {
        throw new Error('connection lost');
      }),
    ).rejects.toThrow('connection lost');
    expect(
      isPublicationRetryNCollision(Object.assign(new Error('dup'), { code: '23505' })),
    ).toBe(true);
    expect(isPublicationRetryNCollision(new Error('connection lost'))).toBe(false);
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
