import { BadRequestException } from '@nestjs/common';
import { assertBodyNonEmpty, assertRejectComment, assertTransition } from './content-workflow.util';

describe('content-workflow.util', () => {
  it('assertBodyNonEmpty rejects empty markdown', () => {
    expect(() => assertBodyNonEmpty({ markdown: '  ' })).toThrow(BadRequestException);
  });

  it('assertTransition rejects draft approve', () => {
    expect(() => assertTransition('draft', ['in_review'], 'approve')).toThrow(BadRequestException);
  });

  it('assertRejectComment requires 10 chars', () => {
    expect(() => assertRejectComment('short')).toThrow(BadRequestException);
    expect(assertRejectComment('Comment đủ dài').length).toBeGreaterThanOrEqual(10);
  });
});
