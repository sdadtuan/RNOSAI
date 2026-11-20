import {
  AM_DEFAULT_CAN_RECEIVE_SOLUTION_MIGRATION,
  bootstrapAmDefaultCanReceiveSolution,
} from './am-default-can-receive-solution.bootstrap';

describe('bootstrapAmDefaultCanReceiveSolution', () => {
  const mockRelease = jest.fn();
  const mockClientQuery = jest.fn();
  const mockConnect = jest.fn(() =>
    Promise.resolve({
      query: mockClientQuery,
      release: mockRelease,
    }),
  );
  const mockPoolQuery = jest.fn();
  const db = {
    query: mockPoolQuery,
    connect: mockConnect,
  } as unknown as import('pg').Pool;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips when migration marker already exists', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await bootstrapAmDefaultCanReceiveSolution(db);

    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockPoolQuery).toHaveBeenCalledTimes(2);
  });

  it('runs backfill once then is a no-op on second call', async () => {
    const firstMarkerMiss = { rowCount: 0 };
    const firstTable = { rowCount: 1 };
    const secondTable = { rowCount: 1 };
    const secondMarkerHit = { rowCount: 1 };

    mockPoolQuery
      .mockResolvedValueOnce(firstTable)
      .mockResolvedValueOnce(firstMarkerMiss)
      .mockResolvedValueOnce(secondTable)
      .mockResolvedValueOnce(secondMarkerHit);

    mockClientQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    await bootstrapAmDefaultCanReceiveSolution(db);
    await bootstrapAmDefaultCanReceiveSolution(db);

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE crm_staff'),
    );
    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO schema_migrations'),
      [AM_DEFAULT_CAN_RECEIVE_SOLUTION_MIGRATION, expect.any(String)],
    );
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
  });

  it('does not update when schema_migrations table is missing', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 0 });

    await bootstrapAmDefaultCanReceiveSolution(db);

    expect(mockConnect).not.toHaveBeenCalled();
  });
});