import { readFileSync } from 'fs';
import { join } from 'path';

describe('lead party HTTP wiring', () => {
  it('exposes GET/PATCH party fields and logo routes', () => {
    const controller = readFileSync(join(__dirname, 'leads.controller.ts'), 'utf8');
    expect(controller).toMatch(/@Post\(':id\/party-logo'\)/);
    expect(controller).toMatch(/@Delete\(':id\/party-logo'\)/);
    expect(controller).toMatch(/@Get\(':id\/party-logo'\)/);
    expect(controller).toMatch(/StaffLeadsWriteGuard/);
    expect(controller).not.toMatch(/createAmAccount/);
  });
});
