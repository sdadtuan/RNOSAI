const PKCE_VERIFIER_KEY = 'ptt_ops_pkce_verifier';
const PKCE_STATE_KEY = 'ptt_ops_oidc_state';
const PKCE_STEPUP_VERIFIER_KEY = 'ptt_ops_pw_stepup_verifier';
const PKCE_STEPUP_STATE_KEY = 'ptt_ops_pw_stepup_state';

export type PkceFlow = 'login' | 'password_step_up';

function pkceKeys(flow: PkceFlow): { verifierKey: string; stateKey: string } {
  if (flow === 'password_step_up') {
    return { verifierKey: PKCE_STEPUP_VERIFIER_KEY, stateKey: PKCE_STEPUP_STATE_KEY };
  }
  return { verifierKey: PKCE_VERIFIER_KEY, stateKey: PKCE_STATE_KEY };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePkceVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function pkceChallengeFromVerifier(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

export function storePkceSession(verifier: string, state: string, flow: PkceFlow = 'login'): void {
  if (typeof sessionStorage === 'undefined') return;
  const keys = pkceKeys(flow);
  sessionStorage.setItem(keys.verifierKey, verifier);
  sessionStorage.setItem(keys.stateKey, state);
}

export function readPkceVerifier(flow: PkceFlow = 'login'): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(pkceKeys(flow).verifierKey);
}

export function readPkceState(flow: PkceFlow = 'login'): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(pkceKeys(flow).stateKey);
}

export function clearPkceSession(flow: PkceFlow = 'login'): void {
  if (typeof sessionStorage === 'undefined') return;
  const keys = pkceKeys(flow);
  sessionStorage.removeItem(keys.verifierKey);
  sessionStorage.removeItem(keys.stateKey);
}

export function randomOidcState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function buildStaffKeycloakAuthUrl(params: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  acrValues?: string;
  prompt?: string;
  flow?: PkceFlow;
}): Promise<string> {
  const flow = params.flow ?? 'login';
  const verifier = generatePkceVerifier();
  const challenge = await pkceChallengeFromVerifier(verifier);
  const state = randomOidcState();
  storePkceSession(verifier, state, flow);

  const authBase = `${params.issuer.replace(/\/$/, '')}/protocol/openid-connect/auth`;
  const qs = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  if (params.acrValues) {
    qs.set('acr_values', params.acrValues);
  }
  if (params.prompt) {
    qs.set('prompt', params.prompt);
  }
  return `${authBase}?${qs.toString()}`;
}
