import { msosDisplayCode, msosDateStamp } from './msos-ids.util';

describe('msos-ids.util', () => {
  it('formats date stamp in Asia/Ho_Chi_Minh', () => {
    const stamp = msosDateStamp(new Date('2026-09-12T10:00:00Z'));
    expect(stamp).toMatch(/^\d{8}$/);
  });

  it('builds PTN display code', () => {
    const code = msosDisplayCode('PTN', new Date('2026-09-12T10:00:00Z'));
    expect(code).toMatch(/^PTN-\d{8}-[A-F0-9]{4}$/);
  });

  it('builds INV display code', () => {
    const code = msosDisplayCode('INV', new Date('2026-09-12T10:00:00Z'));
    expect(code).toMatch(/^INV-\d{8}-[A-F0-9]{4}$/);
  });
});
