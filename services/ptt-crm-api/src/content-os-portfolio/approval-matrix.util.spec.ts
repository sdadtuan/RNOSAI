import {
  DEFAULT_CLAIM_LEXEMES,
  applyApprovalMatrix,
  buildApprovalMatrixForItem,
  claimCategoriesForItem,
  collectClaimScanText,
  detectClaimLexemes,
  resolveMarketCount,
  resolvePaidIntent,
  resolvePaidOk,
} from './approval-matrix.util';

describe('applyApprovalMatrix', () => {
  const base = {
    riskLevel: 'Normal',
    claimCategories: [] as string[],
    paidIntent: false,
    paidOk: true,
    marketCount: 1,
  };

  it('always includes owner, account_director, and client', () => {
    expect(applyApprovalMatrix(base).steps).toEqual(['owner', 'account_director', 'client']);
  });

  it('adds content_lead for Brand-Sensitive and Regulated', () => {
    expect(applyApprovalMatrix({ ...base, riskLevel: 'Brand-Sensitive' }).steps).toEqual([
      'owner',
      'content_lead',
      'account_director',
      'client',
    ]);
    expect(applyApprovalMatrix({ ...base, riskLevel: 'Regulated' }).steps).toContain('content_lead');
  });

  it('adds legal when claimCategories includes Financial, Health, or Legal', () => {
    expect(applyApprovalMatrix({ ...base, claimCategories: ['Legal'] }).steps).toEqual([
      'owner',
      'legal',
      'account_director',
      'client',
    ]);
    expect(applyApprovalMatrix({ ...base, claimCategories: ['Health'] }).steps).toContain('legal');
    expect(applyApprovalMatrix({ ...base, claimCategories: ['Financial'] }).steps).toContain('legal');
  });

  it('blocks when paidIntent is true and paidOk is false', () => {
    expect(applyApprovalMatrix({ ...base, paidIntent: true, paidOk: false }).gateBlockers).toEqual([
      'Paid media rights invalid',
    ]);
  });

  it('does not block when paid is not intended or paidOk is true', () => {
    expect(applyApprovalMatrix({ ...base, paidIntent: true, paidOk: true }).gateBlockers).toEqual([]);
    expect(applyApprovalMatrix({ ...base, paidIntent: false, paidOk: false }).gateBlockers).toEqual([]);
  });
});

describe('DEFAULT_CLAIM_LEXEMES', () => {
  it('is the E1 Vietnamese default list', () => {
    expect(DEFAULT_CLAIM_LEXEMES).toEqual(['cam kết sinh lời', 'giá rẻ', 'số 1']);
  });
});

describe('detectClaimLexemes', () => {
  it('matches default lexemes case-insensitively in Vietnamese copy', () => {
    expect(detectClaimLexemes('Sản phẩm SỐ 1 và Giá Rẻ')).toEqual(['giá rẻ', 'số 1']);
  });

  it('returns empty when no lexeme hits', () => {
    expect(detectClaimLexemes('Nội dung trung lập, không claim.')).toEqual([]);
  });
});

describe('collectClaimScanText / claimCategoriesForItem', () => {
  it('scans brief_json.restricted as a string and as a string[] plus body copy', () => {
    expect(collectClaimScanText({ restricted: 'cam kết sinh lời' }, { markdown: '' })).toContain(
      'cam kết sinh lời',
    );
    expect(collectClaimScanText({ restricted: ['giá rẻ'] }, { markdown: 'ok' })).toContain('giá rẻ');
    expect(collectClaimScanText({}, { markdown: 'Chúng tôi số 1' })).toMatch(/số 1/i);
  });

  it('treats any default lexeme hit as Legal (E1 one-rule)', () => {
    expect(claimCategoriesForItem({ restricted: 'Cam Kết Sinh Lời' }, { markdown: '' })).toEqual(['Legal']);
    expect(claimCategoriesForItem({}, { markdown: 'Gói giá rẻ hôm nay' })).toEqual(['Legal']);
    expect(claimCategoriesForItem({ restricted: 'No medical claims' }, { markdown: 'Hello' })).toEqual([]);
  });
});

describe('paid / market helpers', () => {
  it('paidIntent is true when channel/format suggests paid or a right requests paid_ok', () => {
    expect(resolvePaidIntent({ channel: 'meta_ads', brief_json: {} }, [])).toBe(true);
    expect(resolvePaidIntent({ channel: 'facebook', format: 'ad_copy', brief_json: {} }, [])).toBe(true);
    expect(resolvePaidIntent({ channel: 'facebook', brief_json: { paid: true } }, [])).toBe(true);
    expect(resolvePaidIntent({ channel: 'facebook', brief_json: {} }, [{ paid_ok: true }])).toBe(true);
    expect(resolvePaidIntent({ channel: 'facebook', brief_json: {} }, [])).toBe(false);
  });

  it('paidOk is false only when paidIntent and a required right has paid_ok false', () => {
    expect(resolvePaidOk(true, [{ paid_ok: false }])).toBe(false);
    expect(resolvePaidOk(true, [{ paid_ok: true }])).toBe(true);
    expect(resolvePaidOk(true, [])).toBe(true);
    expect(resolvePaidOk(false, [{ paid_ok: false }])).toBe(true);
  });

  it('marketCount defaults to 1 unless brief.markets is an array', () => {
    expect(resolveMarketCount({})).toBe(1);
    expect(resolveMarketCount({ markets: ['VN', 'TH'] })).toBe(2);
    expect(resolveMarketCount(undefined)).toBe(1);
  });
});

describe('buildApprovalMatrixForItem', () => {
  it('wires claim Legal, paid blocker, and default market into applyApprovalMatrix', () => {
    const out = buildApprovalMatrixForItem(
      {
        risk_level: 'Normal',
        channel: 'google_ads',
        brief_json: { restricted: 'Không cam kết sinh lời' },
        body_json: { markdown: 'Launch' },
      },
      [{ paid_ok: false }],
    );
    expect(out.claim_hits).toEqual(['cam kết sinh lời']);
    expect(out.approval_matrix.steps).toEqual(['owner', 'legal', 'account_director', 'client']);
    expect(out.approval_matrix.gateBlockers).toEqual(['Paid media rights invalid']);
  });
});
