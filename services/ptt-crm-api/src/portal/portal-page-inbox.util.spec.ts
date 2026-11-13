import { Logger } from '@nestjs/common';
import {
  facebookSendError,
  logFacebookSendError,
  redactGraphErrorText,
  sendFacebookText,
} from './portal-page-inbox.util';

describe('facebookSendError', () => {
  it('maps 24h window code 10 / subcode 2018278', () => {
    const text = facebookSendError({
      message: 'This message is sent outside of allowed window.',
      code: 10,
      error_subcode: 2018278,
    });
    expect(text).toContain('ngoài cửa sổ 24 giờ');
    expect(text).toContain('2018278');
  });

  it('maps recipient who is not an app role user', () => {
    const text = facebookSendError({
      message: 'The user is not admins, developers or testers of the app, and the app is live.',
      code: 10,
    });
    expect(text).toMatch(/admin\/tester|quyền nâng cao/);
  });

  it('maps expired token code 190', () => {
    const text = facebookSendError({
      message: 'The session has expired. Please get a new access token.',
      code: 190,
    });
    expect(text).toContain('hết hạn');
    expect(text).toContain('190');
  });

  it('maps code 10/200 pages_messaging as Advanced Access, not a generic token message', () => {
    const text = facebookSendError({
      message: 'Requires pages_messaging permission to manage the object',
      code: 200,
    });
    expect(text).toContain('pages_messaging chưa được duyệt quyền nâng cao');
    expect(text).not.toContain('Token của Page chưa đủ quyền');
  });

  it('maps bare code 10 the same way', () => {
    expect(facebookSendError({ code: 10, message: 'Application does not have permission for this action' })).toContain(
      'quyền nâng cao',
    );
  });
});

describe('redactGraphErrorText / logFacebookSendError', () => {
  it('redacts tokens and logs code, subcode, fbtrace_id without the token', () => {
    const raw = 'token=EAABxyzTOKEN123 access_token=EAABsecret Bearer EAAG123fail pages_messaging';
    const redacted = redactGraphErrorText(raw);
    expect(redacted).not.toMatch(/EAA[A-Za-z0-9]{4,}/);
    expect(redacted).not.toContain('EAABsecret');
    expect(redacted).toContain('<redacted>');

    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    logFacebookSendError(
      {
        message: 'Requires pages_messaging. token=EAAGSHOULDNOTAPPEAR',
        code: 200,
        error_subcode: 0,
        fbtrace_id: 'AbCtrace1',
      },
      { httpStatus: 400 },
    );
    expect(warn).toHaveBeenCalled();
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain('code=200');
    expect(line).toContain('fbtrace=AbCtrace1');
    expect(line).toContain('http=400');
    expect(line).not.toContain('EAAGSHOULDNOTAPPEAR');
    warn.mockRestore();
  });
});

describe('sendFacebookText', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the specific Vietnamese error and logs the raw Graph fields', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: 'Requires pages_messaging permission to manage the object',
          code: 200,
          error_subcode: 0,
          fbtrace_id: 'TraceXYZ',
        },
      }),
    }) as never;

    const out = await sendFacebookText('111', 'EAAG_dummy_token_value', '222', 'hello');
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toContain('pages_messaging chưa được duyệt quyền nâng cao');
    }
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain('code=200');
    expect(line).toContain('fbtrace=TraceXYZ');
    expect(line).not.toContain('EAAG_dummy_token_value');
    warn.mockRestore();
  });
});
