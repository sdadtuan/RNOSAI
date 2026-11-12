import type { PerformanceChannel } from '@/lib/api';

export type PortalChannelConfig = {
  id: PerformanceChannel;
  href: string;
  label: string;
  breadcrumb: string;
  title: string;
  subtitle: string;
  hint: string;
};

export const PORTAL_CHANNELS: Record<PerformanceChannel, PortalChannelConfig> = {
  meta: {
    id: 'meta',
    href: '/meta',
    label: 'Meta',
    breadcrumb: 'Hiệu quả Meta',
    title: 'Hiệu quả Meta',
    subtitle: 'Facebook & Instagram — CPL, chi tiêu và lead',
    hint: 'Facebook / Instagram',
  },
  google: {
    id: 'google',
    href: '/google',
    label: 'Google Ads',
    breadcrumb: 'Hiệu quả Google',
    title: 'Hiệu quả Google Ads',
    subtitle: 'Tìm kiếm & Hiển thị — CPL, chi tiêu và lead',
    hint: 'Tìm kiếm & Hiển thị',
  },
  zalo: {
    id: 'zalo',
    href: '/zalo',
    label: 'Zalo Ads',
    breadcrumb: 'Hiệu quả Zalo',
    title: 'Hiệu quả Zalo Ads',
    subtitle: 'Hệ sinh thái Zalo — CPL, chi tiêu và lead',
    hint: 'Hệ sinh thái Zalo',
  },
};

export const PORTAL_CHANNEL_LIST: PortalChannelConfig[] = [
  PORTAL_CHANNELS.meta,
  PORTAL_CHANNELS.google,
  PORTAL_CHANNELS.zalo,
];

export function portalChannelConfig(channel: PerformanceChannel): PortalChannelConfig {
  return PORTAL_CHANNELS[channel];
}
