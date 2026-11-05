export type StaffAccountRateBucket = 'password' | 'avatar';

export class StaffAccountRateLimiter {
  private readonly hits = new Map<string, number[]>();

  /** Returns true if allowed; false if rate limited. */
  hit(
    bucket: StaffAccountRateBucket,
    userId: string,
    windowMs: number,
    maxHits: number,
    nowMs = Date.now(),
  ): boolean {
    const key = `${bucket}:${userId}`;
    const cutoff = nowMs - windowMs;
    const prev = this.hits.get(key) ?? [];
    const recent = prev.filter((t) => t > cutoff);
    if (recent.length >= maxHits) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(nowMs);
    this.hits.set(key, recent);
    return true;
  }
}
