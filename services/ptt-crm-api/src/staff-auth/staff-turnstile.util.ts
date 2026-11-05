export type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes'?: string[];
};

export async function verifyStaffTurnstileToken(
  secret: string,
  token: string,
  remoteIp?: string | null,
): Promise<boolean> {
  const trimmedSecret = secret.trim();
  const trimmedToken = token.trim();
  if (!trimmedSecret || !trimmedToken) {
    return false;
  }
  const body = new URLSearchParams({
    secret: trimmedSecret,
    response: trimmedToken,
  });
  if (remoteIp?.trim()) {
    body.set('remoteip', remoteIp.trim());
  }
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) {
    return false;
  }
  const data = (await resp.json()) as TurnstileVerifyResponse;
  return Boolean(data.success);
}
