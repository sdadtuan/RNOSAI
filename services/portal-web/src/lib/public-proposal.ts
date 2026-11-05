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

export type PublicProposalViewFields = {
  name: string;
  email: string;
  title?: string;
  optionKey?: string;
  otp?: string;
  accepted: boolean;
};

export function publicProposalSelectedOptionKey(
  data: Pick<PublicProposal, 'option_key' | 'options'>,
  optionKey?: string,
): string {
  const options = visiblePublicOptions(data);
  return optionKey || data.option_key || options[0]?.option_key || 'A';
}

/** Same body the portal view posts when the user confirms. */
export function publicProposalSubmitPayload(
  data: Pick<PublicProposal, 'option_key' | 'options' | 'otp_required'>,
  fields: PublicProposalViewFields,
): PublicAcceptInput {
  return buildPublicAcceptBody({
    accepted: fields.accepted,
    name: fields.name,
    email: fields.email,
    title: fields.title,
    option_key: publicProposalSelectedOptionKey(data, fields.optionKey),
    otp: publicProposalNeedsOtp(data) ? fields.otp : undefined,
  });
}

export function createPublicProposalAccept(opts: { token: string; data: PublicProposal }) {
  const state: PublicProposalViewFields = {
    name: '',
    email: '',
    title: '',
    optionKey: publicProposalSelectedOptionKey(opts.data),
    otp: '',
    accepted: false,
  };

  function fields(): PublicProposalViewFields {
    return { ...state };
  }

  async function onSubmit(body?: PublicAcceptInput) {
    return acceptPublicProposal(opts.token, body ?? publicProposalSubmitPayload(opts.data, fields()));
  }

  return {
    fields,
    view: {
      onName: (value: string) => {
        state.name = value;
      },
      onEmail: (value: string) => {
        state.email = value;
      },
      onTitle: (value: string) => {
        state.title = value;
      },
      onOptionKey: (value: string) => {
        state.optionKey = value;
      },
      onOtp: (value: string) => {
        state.otp = value;
      },
      onAccepted: (value: boolean) => {
        state.accepted = value;
      },
      onSubmit,
    },
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
