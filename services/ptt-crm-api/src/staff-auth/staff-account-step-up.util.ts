export class StaffAccountStepUpStore {
  private readonly activeUntil = new Map<string, number>();

  private key(userId: string, sid: string): string {
    return `${userId}:${sid}`;
  }

  mark(userId: string, sid: string, untilMs: number): void {
    this.activeUntil.set(this.key(userId, sid), untilMs);
  }

  isActive(userId: string, sid: string, nowMs = Date.now()): boolean {
    const until = this.activeUntil.get(this.key(userId, sid));
    if (!until) return false;
    if (until <= nowMs) {
      this.activeUntil.delete(this.key(userId, sid));
      return false;
    }
    return true;
  }

  activeUntilIso(userId: string, sid: string, nowMs = Date.now()): string | null {
    if (!this.isActive(userId, sid, nowMs)) return null;
    const until = this.activeUntil.get(this.key(userId, sid));
    return until ? new Date(until).toISOString() : null;
  }

  clear(userId: string, sid: string): void {
    this.activeUntil.delete(this.key(userId, sid));
  }
}
