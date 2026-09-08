export const PUBLIC_ACCEPT_CTA = 'Xác nhận đề xuất';

export type PublicProposalInvestment = {
  fee_vnd: number | null;
  media_vnd: number | null;
  discount_vnd: number | null;
  tax_vnd: number | null;
  payable_vnd: number | null;
};

export type PublicProposalOption = {
  option_key: string;
  name: string;
  recommended?: boolean;
  client_visible?: boolean;
  payable_vnd?: number | null;
};

export type PublicProposal = {
  quote_code: string | null;
  title: string;
  objective: string;
  audience: string;
  campaign_period: string;
  valid_until: string | null;
  version_n: number;
  status: string;
  kpis: Array<{ label?: string; value?: string }>;
  scope: Array<{ dv_code: string; notes: string }>;
  investment: PublicProposalInvestment;
  payments: Array<{ seq: number; pct_bps: number; amount_vnd: number | null; milestone: string }>;
  options?: PublicProposalOption[];
  option_key: string;
  otp_required?: boolean;
  cta: { accept: string };
};

export type PublicAcceptInput = {
  accepted: boolean;
  name: string;
  email: string;
  title?: string;
  option_key?: string;
  otp?: string;
};

export function visiblePublicOptions(
  data: Pick<PublicProposal, 'options'> | { options?: PublicProposalOption[] },
): PublicProposalOption[] {
  return (data.options ?? []).filter(
    (row) => row.client_visible !== false && row.client_visible !== ('f' as never),
  );
}

export function publicProposalNeedsOtp(data: Pick<PublicProposal, 'otp_required'>): boolean {
  return data.otp_required === true;
}

export function publicHtmlLeaks(html: string): string[] {
  const hits: string[] = [];
  if (/margin/i.test(html)) hits.push('margin');
  if (/\bNSR\b/.test(html)) hits.push('NSR');
  return hits;
}

export function buildPublicAcceptBody(input: PublicAcceptInput): PublicAcceptInput {
  return {
    accepted: input.accepted === true,
    name: String(input.name ?? '').trim(),
    email: String(input.email ?? '').trim(),
    title: String(input.title ?? '').trim() || undefined,
    option_key: String(input.option_key ?? '').trim() || undefined,
    otp: String(input.otp ?? '').replace(/\s+/g, '') || undefined,
  };
}

export type PublicAcceptResult = {
  status: string;
  option_key: string;
};

export function formatPublicMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${new Intl.NumberFormat('vi-VN').format(Number(value))} ₫`;
}

export function isGonePublicProposal(err: { status?: number } | null | undefined): boolean {
  return err?.status === 410;
}

const API_BASE = (process.env.NEXT_PUBLIC_PTT_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

export class PublicProposalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'PublicProposalApiError';
  }
}

async function parseBody<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export async function fetchPublicProposal(token: string): Promise<PublicProposal> {
  const res = await fetch(`${API_BASE}/api/public/proposals/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  const body = await parseBody<PublicProposal & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new PublicProposalApiError(body.message ?? body.error ?? 'Không tải được đề xuất', res.status);
  }
  return body;
}

export async function requestPublicProposalOtp(
  token: string,
  input: { email: string },
): Promise<{ sent: boolean; expires_in_sec?: number }> {
  const res = await fetch(`${API_BASE}/api/public/proposals/${encodeURIComponent(token)}/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ email: input.email }),
  });
  const body = await parseBody<{ sent?: boolean; expires_in_sec?: number; error?: string; message?: string }>(
    res,
  );
  if (!res.ok) {
    throw new PublicProposalApiError(body.message ?? body.error ?? 'Không gửi được OTP', res.status);
  }
  return { sent: body.sent !== false, expires_in_sec: body.expires_in_sec };
}

export async function acceptPublicProposal(
  token: string,
  input: PublicAcceptInput,
): Promise<PublicAcceptResult> {
  const res = await fetch(`${API_BASE}/api/public/proposals/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(buildPublicAcceptBody(input)),
  });
  const body = await parseBody<PublicAcceptResult & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new PublicProposalApiError(
      body.message ?? body.error ?? 'Không xác nhận được đề xuất',
      res.status,
    );
  }
  return body;
}
