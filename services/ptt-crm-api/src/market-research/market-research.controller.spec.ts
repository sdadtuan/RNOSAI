import { BadRequestException } from '@nestjs/common';
import { MarketResearchController } from './market-research.controller';

jest.mock('../staff-client-scope/staff-client-scope.http.util', () => ({
  resolveStaffClientScope: jest.fn(async () => ({ restricted: false, allowedClientIds: [] })),
}));

describe('MarketResearchController export format', () => {
  it('unknown format is 400 validation_error and does not export', async () => {
    const research = { exportReportVersion: jest.fn() };
    const ctrl = new MarketResearchController(research as never, {} as never);

    try {
      await ctrl.exportReportVersion({} as never, 1, 10, 'xlsx');
      throw new Error('expected 400');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual({ error: 'validation_error' });
    }
    expect(research.exportReportVersion).not.toHaveBeenCalled();
  });
});
