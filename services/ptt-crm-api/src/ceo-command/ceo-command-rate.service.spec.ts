import { CeoCommandRateService } from './ceo-command-rate.service';

describe('CeoCommandRateService', () => {
  it('rate limits 2 per window', () => {
    const r = new CeoCommandRateService();
    r.check('ceo-cmd:1', 2, 60_000);
    r.check('ceo-cmd:1', 2, 60_000);
    expect(() => r.check('ceo-cmd:1', 2, 60_000)).toThrow();
  });
});
