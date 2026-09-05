import { describe, expect, it } from 'vitest';
import {
  AM_CONTACT_CHANNELS,
  AM_RENEWAL_ATTITUDES,
  amContactChannelHref,
} from './am-contact-drawer.util';

describe('am-contact-drawer', () => {
  it('exposes Gọi / Email / Zalo channels and renewal attitude', () => {
    expect(AM_CONTACT_CHANNELS.map((row) => row.label)).toEqual(['Gọi', 'Email', 'Zalo']);
    expect(AM_RENEWAL_ATTITUDES.length).toBeGreaterThan(0);
    expect(amContactChannelHref('call', { phone: '0901234567', email: '' })).toBe('tel:0901234567');
    expect(amContactChannelHref('email', { phone: '', email: 'ceo@anphu.vn' })).toBe(
      'mailto:ceo@anphu.vn',
    );
    expect(amContactChannelHref('zalo', { phone: '0901234567', email: '' })).toMatch(/zalo/i);
  });
});
