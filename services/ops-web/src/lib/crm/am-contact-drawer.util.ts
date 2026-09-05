export const AM_CONTACT_CHANNELS = [
  { value: 'call', label: 'Gọi' },
  { value: 'email', label: 'Email' },
  { value: 'zalo', label: 'Zalo' },
] as const;

export const AM_COMMITTEE_ROLES = [
  { value: 'decision_maker', label: 'Decision Maker' },
  { value: 'champion', label: 'Champion' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'economic_buyer', label: 'Economic Buyer' },
  { value: 'user', label: 'User' },
  { value: 'blocker', label: 'Blocker' },
] as const;

export const AM_SENTIMENTS = [
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
] as const;

export const AM_RENEWAL_ATTITUDES = [
  { value: 'champion', label: 'Champion' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'unknown', label: 'Unknown' },
] as const;

export function amContactChannelHref(
  channel: string,
  contact: { phone?: string | null; email?: string | null },
): string {
  const phone = String(contact.phone ?? '').replace(/\s+/g, '');
  const email = String(contact.email ?? '').trim();
  if (channel === 'call') return phone ? `tel:${phone}` : '';
  if (channel === 'email') return email ? `mailto:${email}` : '';
  if (channel === 'zalo') return phone ? `https://zalo.me/${phone}` : '';
  return '';
}

export function amContactRoleLabel(value: string | null | undefined): string {
  return AM_COMMITTEE_ROLES.find((row) => row.value === value)?.label || value || '—';
}

export function amContactSentimentLabel(value: string | null | undefined): string {
  return AM_SENTIMENTS.find((row) => row.value === value)?.label || value || '—';
}

export function amContactAttitudeLabel(value: string | null | undefined): string {
  return AM_RENEWAL_ATTITUDES.find((row) => row.value === value)?.label || value || '—';
}
