/** Dev-only: staff login 401 fallback → portal client session on ops-web /client/* (off by default). */
export function opsClientLoginFallbackEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_OPS_CLIENT_LOGIN_FALLBACK ?? '0').trim() === '1';
}
