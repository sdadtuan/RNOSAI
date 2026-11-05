export type ChannelHealthStatus = 'Manual' | 'Connected' | 'TokenExpired';

export const PUBLISH_CTA_COPY = 'Đăng ký nhận tư vấn';

export function canShowDangLenPage(input: {
  directSocialPublish: boolean;
  health: ChannelHealthStatus;
  canPublish: boolean;
}): boolean {
  return input.directSocialPublish && input.health === 'Connected' && input.canPublish;
}

export function canOpenConfirm(gateStatus: 'Pass' | 'Warning' | 'Blocked'): boolean {
  return gateStatus !== 'Blocked';
}

export type ChannelAccountLike = {
  channel?: string;
  health?: { status?: string };
};

export function facebookPageHealth(items: ChannelAccountLike[] | undefined): ChannelHealthStatus {
  const page = (items ?? []).find((row) => row.channel === 'facebook_page') ?? items?.[0];
  const status = page?.health?.status;
  if (status === 'Connected' || status === 'TokenExpired' || status === 'Manual') return status;
  return 'Manual';
}
