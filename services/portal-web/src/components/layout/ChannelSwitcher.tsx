'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PerformanceChannel } from '@/lib/api';
import { PORTAL_CHANNEL_LIST } from '@/lib/portal/channels';
import { usePortalAdsChannelIds } from '@/lib/portal/ads-channels';

type ChannelSwitcherProps = {
  active: PerformanceChannel;
};

export function ChannelSwitcher({ active }: ChannelSwitcherProps) {
  const pathname = usePathname();
  const ids = usePortalAdsChannelIds();
  const channels = PORTAL_CHANNEL_LIST.filter((channel) => (ids == null ? channel.id === active : ids.includes(channel.id)));

  return (
    <nav className="channel-switcher" aria-label="Chọn kênh quảng cáo">
      {channels.map((channel) => {
        const isActive = channel.id === active || pathname === channel.href;
        return (
          <Link
            key={channel.id}
            href={channel.href}
            className={`channel-switcher__item${isActive ? ' channel-switcher__item--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <strong>{channel.label}</strong>
            <span className="muted">{channel.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
