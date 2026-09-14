import { assertRawLeadPushable } from './push-crm.util';

describe('assertRawLeadPushable', () => {
  it('rejects non-contactable', () => {
    expect(
      assertRawLeadPushable({
        status: 'accepted',
        contactable: false,
      }),
    ).toEqual({ ok: false, error: 'not_contactable' });
  });

  it('rejects not accepted', () => {
    expect(
      assertRawLeadPushable({ status: 'pending', contactable: true }),
    ).toEqual({ ok: false, error: 'not_accepted' });
  });

  it('rejects already_customer', () => {
    expect(
      assertRawLeadPushable({
        status: 'accepted',
        contactable: true,
        verify_json: { already_customer: true },
      }),
    ).toEqual({ ok: false, error: 'already_customer' });
  });

  it('accepts pushable lead', () => {
    expect(
      assertRawLeadPushable({ status: 'accepted', contactable: true }),
    ).toEqual({ ok: true });
  });
});
