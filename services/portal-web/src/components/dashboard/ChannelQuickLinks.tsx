import Link from 'next/link';

const CHANNELS = [
  { href: '/meta', label: 'Meta', hint: 'Facebook / IG' },
  { href: '/google', label: 'Google Ads', hint: 'Search & Display' },
  { href: '/zalo', label: 'Zalo Ads', hint: 'Zalo ecosystem' },
] as const;

export function ChannelQuickLinks() {
  return (
    <nav className="channel-quick-links" aria-label="Kênh quảng cáo">
      {CHANNELS.map((channel) => (
        <Link key={channel.href} href={channel.href} className="channel-quick-links__item">
          <strong>{channel.label}</strong>
          <span className="muted">{channel.hint}</span>
        </Link>
      ))}
    </nav>
  );
}
