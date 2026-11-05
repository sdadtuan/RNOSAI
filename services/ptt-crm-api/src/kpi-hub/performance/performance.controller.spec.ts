import { PerformanceController } from './performance.controller';

describe('PerformanceController', () => {
  it('exposes activate close reopen snapshot audit export', () => {
    const proto = PerformanceController.prototype;
    expect(typeof proto.activateAssignment).toBe('function');
    expect(typeof proto.closePeriod).toBe('function');
    expect(typeof proto.reopenPeriod).toBe('function');
    expect(typeof proto.snapshots).toBe('function');
    expect(typeof proto.auditLogs).toBe('function');
    expect(typeof proto.exportReport).toBe('function');
    expect(typeof proto.getAssignment).toBe('function');
    expect(typeof proto.reviewCheckIn).toBe('function');
  });
});
