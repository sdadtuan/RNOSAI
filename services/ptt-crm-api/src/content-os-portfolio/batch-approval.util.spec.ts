import { BadRequestException, ConflictException } from '@nestjs/common';
import { CMKT_APPROVE_REJECT_FROM } from '../content-marketing/content-workflow.util';
import {
  CMKT_BATCH_APPROVE_MAX,
  actorIsItemCreator,
  assertSameApproveStep,
  canApproveAsDelegate,
  isCmktSodEnabled,
  isDelegateExpired,
  parseBatchItemIds,
  parseDelegateUntil,
} from './batch-approval.util';

describe('CMKT_BATCH_APPROVE_MAX', () => {
  it('caps a batch at 20 items', () => {
    expect(CMKT_BATCH_APPROVE_MAX).toBe(20);
  });
});

describe('parseBatchItemIds', () => {
  it('rejects an empty list with 400', () => {
    try {
      parseBatchItemIds([]);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'empty_item_ids' }),
      );
    }
  });

  it('rejects more than 20 ids with 400', () => {
    const ids = Array.from({ length: 21 }, (_, i) => i + 1);
    try {
      parseBatchItemIds(ids);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'batch_limit', max: 20 }),
      );
    }
  });

  it('rejects 21 submitted entries before dedupe or filter', () => {
    const ids = [1, 1, 1, 0, -4, 'x', '', null, undefined, 2, 2, '2', 3, 0, 'y', false, 4, 4, 5, 6, 7];
    expect(ids).toHaveLength(21);
    try {
      parseBatchItemIds(ids);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'batch_limit', max: 20 }),
      );
    }
  });

  it('returns unique positive integers up to the cap', () => {
    expect(parseBatchItemIds([3, 1, 3, '2', 0, -4, 'x'])).toEqual([3, 1, 2]);
  });
});

describe('assertSameApproveStep', () => {
  it('returns the shared status when every item is on one approve-from step', () => {
    expect(assertSameApproveStep(['in_review', 'in_review'])).toBe('in_review');
    expect(CMKT_APPROVE_REJECT_FROM).toContain('in_review');
  });

  it('throws 409 mixed_step when current statuses differ', () => {
    try {
      assertSameApproveStep(['in_review', 'draft']);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ error: 'mixed_step' }),
      );
    }
  });

  it('throws 409 mixed_step when an optional step does not match the shared status', () => {
    try {
      assertSameApproveStep(['in_review', 'in_review'], 'draft');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ error: 'mixed_step' }),
      );
    }
  });
});

describe('isCmktSodEnabled', () => {
  it('is off by default', () => {
    expect(isCmktSodEnabled({})).toBe(false);
    expect(isCmktSodEnabled({ CMKT_SOD_ENABLED: '' })).toBe(false);
    expect(isCmktSodEnabled({ CMKT_SOD_ENABLED: '0' })).toBe(false);
  });

  it('turns on only when CMKT_SOD_ENABLED is 1 or the tenant flag is true', () => {
    expect(isCmktSodEnabled({ CMKT_SOD_ENABLED: '1' })).toBe(true);
    expect(isCmktSodEnabled({}, true)).toBe(true);
    expect(isCmktSodEnabled({ CMKT_SOD_ENABLED: '0' }, false)).toBe(false);
  });
});

describe('actorIsItemCreator', () => {
  it('matches created_by, first version author, or package.created_by case-insensitively', () => {
    expect(
      actorIsItemCreator('AM@PTT.VN', {
        created_by: 'am@ptt.vn',
        first_version_author: null,
        package_created_by: null,
      }),
    ).toBe(true);
    expect(
      actorIsItemCreator('am@ptt.vn', {
        created_by: 'other@ptt.vn',
        first_version_author: 'AM@ptt.vn',
        package_created_by: null,
      }),
    ).toBe(true);
    expect(
      actorIsItemCreator('am@ptt.vn', {
        created_by: 'other@ptt.vn',
        first_version_author: 'qa@ptt.vn',
        package_created_by: 'am@PTT.vn',
      }),
    ).toBe(true);
    expect(
      actorIsItemCreator('lead@ptt.vn', {
        created_by: 'am@ptt.vn',
        first_version_author: 'sp@ptt.vn',
        package_created_by: 'qa@ptt.vn',
      }),
    ).toBe(false);
  });
});

describe('delegate until', () => {
  const now = new Date('2026-09-11T04:00:00.000Z');

  it('parses an ISO timestamp and rejects invalid input', () => {
    expect(parseDelegateUntil('2026-09-12T00:00:00.000Z')).toBe('2026-09-12T00:00:00.000Z');
    try {
      parseDelegateUntil('not-a-date');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: 'invalid_delegate_until' }),
      );
    }
  });

  it('treats a past delegate_until as expired so the delegate cannot approve', () => {
    expect(isDelegateExpired('2026-09-10T00:00:00.000Z', now)).toBe(true);
    expect(canApproveAsDelegate('2026-09-10T00:00:00.000Z', now)).toBe(false);
  });

  it('allows approve-as-delegate only while the window is still open', () => {
    expect(isDelegateExpired('2026-09-12T00:00:00.000Z', now)).toBe(false);
    expect(canApproveAsDelegate('2026-09-12T00:00:00.000Z', now)).toBe(true);
    expect(canApproveAsDelegate(null, now)).toBe(false);
  });
});
