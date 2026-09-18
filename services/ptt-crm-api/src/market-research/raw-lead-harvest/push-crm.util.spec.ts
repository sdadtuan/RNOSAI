import { assertRawLeadPushable } from './push-crm.util';

describe('assertRawLeadPushable', () => {
  it('rejects non-contactable ready lead', () => {
    expect(
      assertRawLeadPushable({
        status: 'pending',
        contactable: false,
        readiness_status: 'READY_TO_PUSH',
      }),
    ).toEqual({ ok: false, error: 'not_contactable' });
  });

  it('rejects non-ready readiness', () => {
    expect(
      assertRawLeadPushable({
        status: 'pending',
        contactable: true,
        readiness_status: 'NEEDS_REVIEW',
      }),
    ).toEqual({ ok: false, error: 'not_ready_to_push' });
  });

  it('rejects legacy not accepted', () => {
    expect(
      assertRawLeadPushable({ status: 'pending', contactable: true }),
    ).toEqual({ ok: false, error: 'not_accepted' });
  });

  it('rejects already_customer', () => {
    expect(
      assertRawLeadPushable({
        status: 'pending',
        contactable: true,
        readiness_status: 'READY_TO_PUSH',
        verify_json: { already_customer: true },
      }),
    ).toEqual({ ok: false, error: 'already_customer' });
  });

  it('accepts READY_TO_PUSH contactable lead', () => {
    expect(
      assertRawLeadPushable({
        status: 'pending',
        contactable: true,
        readiness_status: 'READY_TO_PUSH',
      }),
    ).toEqual({ ok: true });
  });

  it('accepts legacy accepted lead', () => {
    expect(
      assertRawLeadPushable({ status: 'accepted', contactable: true }),
    ).toEqual({ ok: true });
  });
});
