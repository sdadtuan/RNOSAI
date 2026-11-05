import { BadRequestException } from '@nestjs/common';

export function assertInternalEmailRecipients(emails: string[], domains: string[]): void {
  const allow = domains.map((d) => d.toLowerCase().trim()).filter(Boolean);
  if (!allow.length) allow.push('pttads.vn');
  for (const raw of emails) {
    const email = String(raw ?? '').trim().toLowerCase();
    const domain = email.split('@')[1];
    if (!domain || !allow.includes(domain)) {
      throw new BadRequestException({ error: 'iwr_external_needs_approval' });
    }
  }
}

export function parseInternalEmailDomains(env?: string): string[] {
  const raw = String(env ?? process.env.PTT_IWR_INTERNAL_EMAIL_DOMAINS ?? 'pttads.vn');
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}
