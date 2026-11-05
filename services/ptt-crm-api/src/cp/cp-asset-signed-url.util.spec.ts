import {
  mintAssetStreamQuery,
  signAssetStream,
  verifyAssetStream,
} from './cp-asset-signed-url.util';

const SECRET = 'unit-test-asset-stream-secret';
const ID = '7ec2dfc1-2f55-4493-80e7-cf41b137175d';

describe('cp-asset-signed-url', () => {
  it('mints a query that verifies for the same resource and id', () => {
    const now = 1_779_000_000;
    const minted = mintAssetStreamQuery({
      resource: 'creative',
      id: ID,
      secret: SECRET,
      nowSec: now,
      ttlSec: 900,
    });

    expect(minted.exp).toBe(now + 900);
    expect(verifyAssetStream({
      resource: 'creative',
      id: ID,
      exp: minted.exp,
      sig: minted.sig,
      secret: SECRET,
      nowSec: now + 10,
    })).toBe('ok');
  });

  it('rejects expired, mismatched, and wrong-secret signatures', () => {
    const exp = 1_779_000_900;
    const sig = signAssetStream({
      resource: 'cp_asset',
      id: ID,
      exp,
      secret: SECRET,
    });

    expect(verifyAssetStream({
      resource: 'cp_asset',
      id: ID,
      exp,
      sig,
      secret: SECRET,
      nowSec: exp + 1,
    })).toBe('expired');
    expect(verifyAssetStream({
      resource: 'creative',
      id: ID,
      exp,
      sig,
      secret: SECRET,
      nowSec: exp - 10,
    })).toBe('invalid');
    expect(verifyAssetStream({
      resource: 'cp_asset',
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      exp,
      sig,
      secret: SECRET,
      nowSec: exp - 10,
    })).toBe('invalid');
    expect(verifyAssetStream({
      resource: 'cp_asset',
      id: ID,
      exp,
      sig: 'deadbeef',
      secret: SECRET,
      nowSec: exp - 10,
    })).toBe('invalid');
    expect(verifyAssetStream({
      resource: 'cp_asset',
      id: ID,
      exp,
      sig,
      secret: 'other-secret',
      nowSec: exp - 10,
    })).toBe('invalid');
  });
});
