import {
  LEAD_PARTY_LOGO_MAX_BYTES,
  assertLeadPartySendable,
  isLeadPartyLogoMimeAllowed,
  prefillCompanyName,
  snapshotLeadParty,
} from './lead-party.util';

describe('prefillCompanyName', () => {
  it('prefers column then meta.company_name, meta.company, LMP, intake — never full_name', () => {
    expect(
      prefillCompanyName({
        column: '  360 Auto  ',
        meta: { company_name: 'Meta Co', company: 'Meta Inc' },
        lmpCompanyName: 'LMP Co',
        intakeCompanyName: 'Intake Co',
        fullName: 'Tuan Truong',
      }),
    ).toBe('360 Auto');

    expect(
      prefillCompanyName({
        column: '',
        meta: { company_name: 'Meta Co', company: 'Meta Inc' },
        lmpCompanyName: 'LMP Co',
        intakeCompanyName: 'Intake Co',
        fullName: 'Tuan Truong',
      }),
    ).toBe('Meta Co');

    expect(
      prefillCompanyName({
        column: '   ',
        meta: { company: 'Meta Inc' },
        lmpCompanyName: 'LMP Co',
        intakeCompanyName: 'Intake Co',
        fullName: 'Tuan Truong',
      }),
    ).toBe('Meta Inc');

    expect(
      prefillCompanyName({
        column: '',
        meta: {},
        lmpCompanyName: 'LMP Co',
        intakeCompanyName: 'Intake Co',
        fullName: 'Tuan Truong',
      }),
    ).toBe('LMP Co');

    expect(
      prefillCompanyName({
        column: '',
        meta: {},
        intakeCompanyName: 'Intake Co',
        fullName: 'Tuan Truong',
      }),
    ).toBe('Intake Co');

    expect(
      prefillCompanyName({
        column: '',
        meta: { company_name: '' },
        fullName: 'Tuan Truong',
      }),
    ).toBe('');
  });
});

describe('assertLeadPartySendable', () => {
  it('rejects short company_name with Vietnamese copy', () => {
    expect(assertLeadPartySendable({ company_name: 'A', phone: '0901', email: '' })).toEqual({
      ok: false,
      error: 'company_name_required',
      message: 'Nhập tên công ty trước khi gửi báo giá.',
    });
  });

  it('rejects missing phone and email', () => {
    expect(
      assertLeadPartySendable({ company_name: '360 Auto', phone: '  ', email: 'not-an-email' }),
    ).toEqual({
      ok: false,
      error: 'contact_required',
      message: 'Cần SĐT hoặc email trên Lead để gửi báo giá.',
    });
  });

  it('allows company + phone without address or logo', () => {
    expect(
      assertLeadPartySendable({
        company_name: '360 Auto',
        phone: '0901234567',
        email: '',
        company_address: '',
        logo_asset_id: '',
      }),
    ).toEqual({ ok: true });
  });

  it('allows company + email without phone', () => {
    expect(
      assertLeadPartySendable({
        company_name: '360 Auto',
        phone: '',
        email: 'am@360auto.vn',
      }),
    ).toEqual({ ok: true });
  });
});

describe('snapshotLeadParty', () => {
  it('copies lead_party fields and does not use full_name as company', () => {
    expect(
      snapshotLeadParty({
        company_name: '360 Auto Detailing',
        full_name: 'Tuan Truong',
        company_address: '12 Nguyễn Huệ',
        phone: '0901',
        email: 'a@b.c',
        logo_asset_id: 'asset-1',
      }),
    ).toEqual({
      company_name: '360 Auto Detailing',
      contact_name: 'Tuan Truong',
      address: '12 Nguyễn Huệ',
      phone: '0901',
      email: 'a@b.c',
      logo_asset_id: 'asset-1',
    });
  });
});

describe('isLeadPartyLogoMimeAllowed', () => {
  it('allows PNG/JPEG/WebP and rejects others; max 2MB', () => {
    expect(isLeadPartyLogoMimeAllowed('image/png')).toBe(true);
    expect(isLeadPartyLogoMimeAllowed('image/jpeg')).toBe(true);
    expect(isLeadPartyLogoMimeAllowed('image/webp')).toBe(true);
    expect(isLeadPartyLogoMimeAllowed('image/gif')).toBe(false);
    expect(isLeadPartyLogoMimeAllowed('application/pdf')).toBe(false);
    expect(LEAD_PARTY_LOGO_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
});
