import { deriveInboxFlags, displayVnPhone, extractContacts } from './portal-care.util';

describe('deriveInboxFlags', () => {
  const base = {
    kind: 'message',
    status: 'caring',
    last_direction: 'in',
    last_inbound_at: '2026-11-12T08:00:00.000Z',
    last_read_at: '',
    received_at: '2026-11-12T07:00:00.000Z',
  };

  it('marks unreplied when the last message is inbound', () => {
    expect(deriveInboxFlags(base).unreplied).toBe(true);
    expect(deriveInboxFlags({ ...base, last_direction: 'out' }).unreplied).toBe(false);
  });

  it('treats waiting_receive with no last_read_at as unread', () => {
    const flags = deriveInboxFlags({ ...base, status: 'waiting_receive', received_at: '' });
    expect(flags.unread).toBe(true);
  });

  it('is unread when inbound is after last_read_at', () => {
    expect(
      deriveInboxFlags({ ...base, last_read_at: '2026-11-12T07:30:00.000Z' }).unread,
    ).toBe(true);
    expect(
      deriveInboxFlags({ ...base, last_read_at: '2026-11-12T08:30:00.000Z' }).unread,
    ).toBe(false);
  });

  it('is unread after receive if a newer inbound arrived', () => {
    expect(deriveInboxFlags(base).unread).toBe(true);
    expect(
      deriveInboxFlags({ ...base, last_inbound_at: '2026-11-12T06:00:00.000Z' }).unread,
    ).toBe(false);
  });
});

describe('extractContacts / displayVnPhone', () => {
  it('normalizes +84 to a leading 0', () => {
    expect(displayVnPhone('+84 912 345 678')).toBe('0912345678');
    expect(displayVnPhone('0912.345.678')).toBe('0912345678');
  });

  it('extracts phones and emails from a message', () => {
    const found = extractContacts('Liên hệ +84 912 345 678 hoặc a.b@PTT.vn nha');
    expect(found.phones).toEqual(['0912345678']);
    expect(found.emails).toEqual(['a.b@ptt.vn']);
  });
});
