import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class CeoCommandRateService {
  private readonly buckets = new Map<string, number[]>();

  check(actorKey: string, limit: number, windowMs: number): void {
    const cap = Math.max(1, limit);
    const window = Math.max(1000, windowMs);
    const now = Date.now();
    const key = actorKey.trim() || 'anonymous';
    const prev = (this.buckets.get(key) ?? []).filter((ts) => now - ts < window);

    if (prev.length >= cap) {
      const oldest = prev[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((window - (now - oldest)) / 1000));
      throw new HttpException(
        {
          error: 'ceo_rate_limited',
          message: 'Thử lại sau vài phút',
          retry_after_sec: retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    prev.push(now);
    this.buckets.set(key, prev);
  }

  reset(): void {
    this.buckets.clear();
  }
}
