import { parsePageAllowlist } from './fb-page-allowlist.util';

describe('parsePageAllowlist', () => {
  it('splits comma/space and drops empty', () => {
    expect([...parsePageAllowlist(' 111,222 333,')].sort()).toEqual(['111', '222', '333']);
  });
});
