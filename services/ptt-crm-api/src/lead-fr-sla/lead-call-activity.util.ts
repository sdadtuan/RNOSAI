const CALL_RESULT_LABEL: Record<string, string> = {
  ring_no_answer: 'Đã gọi, khách không nghe máy',
  unreachable: 'Đã gọi, máy bận hoặc không kết nối được',
  callback_requested: 'Khách hẹn gọi lại',
  wrong_number: 'Số điện thoại không đúng',
  connected_meet_pending: 'Đã nói chuyện, đang chờ gặp',
  connected_qualified: 'Đã nói chuyện, đã rõ nhu cầu',
  connected_other: 'Đã nói chuyện',
};

const CHANNEL_LABEL: Record<string, string> = {
  phone: '',
  zalo: 'qua Zalo',
  sms: 'qua tin nhắn',
  email: 'qua thư',
};

const B2B_STATE_LABEL: Record<string, string> = {
  started: 'Bắt đầu gọi',
  answered: 'Khách nghe máy',
  no_answer: 'Khách không nghe máy',
  ended: 'Kết thúc cuộc gọi',
};

function viaChannel(channel: string): string {
  const extra = CHANNEL_LABEL[channel];
  if (extra === undefined) return channel ? `qua ${channel}` : '';
  return extra;
}

export function formatLeadCallActivity(input: {
  callResult: string;
  channel: string;
  notes?: string | null;
  disposition?: string | null;
  leadStatus?: string | null;
  callbackAt?: Date | null;
}): { content: string; result: string } {
  const result = String(input.callResult || '').trim();
  const base = CALL_RESULT_LABEL[result] ?? 'Đã gọi';
  const via = viaChannel(String(input.channel || 'phone').trim().toLowerCase());
  const lines = [via ? `${base}, ${via}` : base];
  const disposition = String(input.disposition ?? '').trim();
  if (disposition) lines.push(disposition);
  const notes = String(input.notes ?? '').trim();
  if (notes) lines.push(notes);
  if (input.callbackAt && !Number.isNaN(input.callbackAt.getTime())) {
    const when = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(input.callbackAt);
    lines.push(`Hẹn gọi lại lúc ${when}`);
  }
  return { content: lines.join('\n').slice(0, 8000), result: result.slice(0, 80) };
}

export function formatB2bCallActivity(input: {
  state: string;
  leadStatus?: string | null;
}): { content: string; result: string } | null {
  const state = String(input.state || '').trim();
  const label = B2B_STATE_LABEL[state];
  if (!label) return null;
  return { content: label, result: `b2b_${state}`.slice(0, 80) };
}
