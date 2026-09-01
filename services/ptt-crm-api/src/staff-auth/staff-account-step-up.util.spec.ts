import { StaffAccountStepUpStore } from './staff-account-step-up.util';

describe('StaffAccountStepUpStore', () => {
  it('marks and checks active window', () => {
    const store = new StaffAccountStepUpStore();
    const now = 1_000_000;
    store.mark('u1', 's1', now + 60_000);
    expect(store.isActive('u1', 's1', now + 30_000)).toBe(true);
    expect(store.isActive('u1', 's1', now + 60_001)).toBe(false);
  });

  it('returns active until iso', () => {
    const store = new StaffAccountStepUpStore();
    store.mark('u1', 's1', 1_060_000);
    expect(store.activeUntilIso('u1', 's1', 1_000_000)).toBe(new Date(1_060_000).toISOString());
  });
});
