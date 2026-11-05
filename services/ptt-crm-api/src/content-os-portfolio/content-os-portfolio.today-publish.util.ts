export type TodayPublishGate = 'Pass' | 'Warning' | 'Blocked';
export type TodayPublishHealth = 'Manual' | 'Connected' | 'TokenExpired';

export type TodayPublishRow = {
  item_id: number;
  display_code: string;
  page_name: string;
  gate: TodayPublishGate;
  blockers: number;
  health: TodayPublishHealth;
};

export const TODAY_PUBLISH_TZ = 'Asia/Ho_Chi_Minh';

export function todayPublishRange(now = new Date()): { from: string; to: string } {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TODAY_PUBLISH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return {
    from: `${ymd}T00:00:00.000+07:00`,
    to: `${ymd}T23:59:59.999+07:00`,
  };
}

export function mapTodayPublishRow(input: {
  item_id: number;
  display_code: string;
  page_name: string;
  gate: TodayPublishGate;
  blockerCount: number;
  health: TodayPublishHealth;
}): TodayPublishRow {
  return {
    item_id: input.item_id,
    display_code: input.display_code,
    page_name: input.page_name,
    gate: input.gate,
    blockers: input.blockerCount,
    health: input.health,
  };
}

export function isFacebookPublishChannel(channel: string | null | undefined): boolean {
  return channel === 'facebook' || channel === 'facebook_page';
}
