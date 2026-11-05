import { rebuildExceptions } from './msos-exceptions.util';

describe('msos-exceptions.util', () => {
  it('derives P0 capacity conflict from calendar', () => {
    const out = rebuildExceptions({
      calendarConflicts: [{ placement_id: 'pl1', date: '2026-09-12' }],
      liveUnofficial: [],
      makeGoodUnreserved: [],
      trafficRejected: [],
    });
    expect(out).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ priority: 'P0', kind: 'capacity_conflict' }),
      ]),
    );
  });

  it('derives P0 evidence unofficial for live lines', () => {
    const out = rebuildExceptions({
      calendarConflicts: [],
      liveUnofficial: [{ media_line_id: 'ml1', display_code: 'ML-1' }],
      makeGoodUnreserved: [],
      trafficRejected: [],
    });
    expect(out).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ priority: 'P0', kind: 'evidence_unofficial' }),
      ]),
    );
  });

  it('derives P1 make-good unreserved and traffic rejected', () => {
    const out = rebuildExceptions({
      calendarConflicts: [],
      liveUnofficial: [],
      makeGoodUnreserved: [{ media_line_id: 'ml1', display_code: 'MG-1' }],
      trafficRejected: [{ media_line_id: 'ml2', display_code: 'ML-2' }],
    });
    expect(out).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ priority: 'P1', kind: 'make_good_unreserved' }),
        expect.objectContaining({ priority: 'P1', kind: 'traffic_rejected' }),
      ]),
    );
  });

  it('returns empty when no issues', () => {
    expect(
      rebuildExceptions({
        calendarConflicts: [],
        liveUnofficial: [],
        makeGoodUnreserved: [],
        trafficRejected: [],
      }),
    ).toEqual([]);
  });
});
