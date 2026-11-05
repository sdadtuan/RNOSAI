import { describe, expect, it } from 'vitest';
import { nextActionFor } from './canopy-next-action';

describe('nextActionFor', () => {
  it('guides B2B lead list', () => {
    expect(nextActionFor('/crm/b2b/leads')).toMatch(/lead Nóng/i);
  });

  it('guides intake wizard', () => {
    expect(nextActionFor('/crm/intake?lead_id=1')).toMatch(/BANT/);
  });

  it('skips login', () => {
    expect(nextActionFor('/login')).toBeNull();
  });

  it('hides the Sale prompt above Solution for Marketing Leader', () => {
    expect(nextActionFor('/crm/b2b/leads', { hideSaleEarly: true })).toBeNull();
    expect(nextActionFor('/crm/leads/920003', { hideSaleEarly: true })).toBeNull();
    expect(nextActionFor('/crm/solution/queue', { hideSaleEarly: true })).toMatch(/báo giá/i);
  });
});
