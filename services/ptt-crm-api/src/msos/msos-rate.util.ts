import { UnprocessableEntityException } from '@nestjs/common';

export function assertRateBindable(status: string): void {
  if (status !== 'published') {
    throw new UnprocessableEntityException({ error: 'rate_not_published' });
  }
}
