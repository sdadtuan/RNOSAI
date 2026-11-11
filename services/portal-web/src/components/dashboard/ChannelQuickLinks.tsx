import Link from 'next/link';
import { PORTAL_CHANNEL_LIST } from '@/lib/portal/channels';
import { usePortalAdsChannelIds } from '@/lib/portal/ads-channels';

export function ChannelQuickLinks() {
  const ids = usePortalAdsChannelIds();
  const channels = PORTAL_CHANNEL_LIST.filter((channel) => ids?.includes(channel.id));
  if (channels.length === 0) return null;
  return (
    <nav className="channel-quick-links" aria-label="Kênh quảng cáo">
      {channels.map((channel) => (
        <Link key={channel.id} href={channel.href} className="channel-quick-links__item">
          <strong>{channel.label}</strong>
          <span className="muted">{channel.hint}</span>
        </Link>
      ))}
    </nav>
  );
}
