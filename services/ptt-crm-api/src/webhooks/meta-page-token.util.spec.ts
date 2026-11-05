import {
  pageAccessTokenFromPageNode,
  pickPageAccessTokenFromAccounts,
} from './meta-page-token.util';

describe('pageAccessTokenFromPageNode', () => {
  it('reads access_token from a Page node', () => {
    expect(pageAccessTokenFromPageNode({ id: 'P1', access_token: 'EAA_page' })).toBe('EAA_page');
    expect(pageAccessTokenFromPageNode({ id: 'P1' })).toBeNull();
  });
});

describe('pickPageAccessTokenFromAccounts', () => {
  const payload = {
    data: [
      { id: '111', name: 'Other', access_token: 'tok-other' },
      { id: '1222371747615610', name: 'PTT Ads', access_token: 'tok-ptt' },
    ],
  };

  it('picks the matching page token', () => {
    expect(pickPageAccessTokenFromAccounts(payload, '1222371747615610')).toBe('tok-ptt');
  });

  it('returns null when page is not in accounts', () => {
    expect(pickPageAccessTokenFromAccounts(payload, '999')).toBeNull();
  });
});
