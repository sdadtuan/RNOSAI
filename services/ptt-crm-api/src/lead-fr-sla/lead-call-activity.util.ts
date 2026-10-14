import { leadStatusLabel } from '../leads/lead-status-gate.util';

const CALL_RESULT_LABEL: Record<string, string> = {
  ring_no_answer: 'Đổ chuông — khách không bắt máy',
  unreachable: 'Không liên lạc được (máy bận hoặc không kết nối)',
  callback_requested: 'Hẹn gọi lại',
  wrong_number: 'Sai số',
  connected_meet_pending: 'Đã nói chuyện — chờ gặp',
  connected_qualified: 'Đã nói chuyện — đủ thông tin',
  connected_other: 'Đã nói chuyện',
};

const CHANNEL_LABEL: Record<string, string> = {
  phone: 'Điện thoại',
  zalo: 'Zalo',
  sms: 'SMS',
  email: 'Email',
};

const B2B_STATE_LABEL: Record<string, string> = {
  started: 'AE bắt đầu gọi',
  answered: 'Khách nghe máy',
  no_answer: 'Không nghe máy',
  ended: 'Kết thúc cuộc gọi',
};

export function formatLeadCallActivity(input: {
  callResult: string;
  channel: string;
  notes?: string | null;
  disposition?: string | null;
  leadStatus?: string | null;
  callbackAt?: Date | null;
}): { content: string; result: string } {
  const result = String(input.callResult || '').trim();
  const lines = [
    CALL_RESULT_LABEL[result] ?? (result || 'Cuộc gọi'),
    `Kênh: ${CHANNEL_LABEL[input.channel] ?? input.channel}`,
  ];
  const disposition = String(input.disposition ?? '').trim();
  if (disposition) lines.push(disposition);
  const notes = String(input.notes ?? '').trim();
  if (notes) lines.push(notes);
  if (input.callbackAt && !Number.isNaN(input.callbackAt.getTime())) {
    lines.push(`Hẹn: ${input.callbackAt.toISOString()}`);
  }
  lines.push(`Trạng thái lead lúc ghi: ${leadStatusLabel(String(input.leadStatus ?? ''))}`);
  return { content: lines.join('\n').slice(0, 8000), result: result.slice(0, 80) };
}

export function formatB2bCallActivity(input: {
  state: string;
  leadStatus?: string | null;
}): { content: string; result: string } | null {
  const state = String(input.state || '').trim();
  const label = B2B_STATE_LABEL[state];
  if (!label) return null;
  return {
    content: `${label}\nTrạng thái lead lúc ghi: ${leadStatusLabel(String(input.leadStatus ?? ''))}`,
    result: `b2b_${state}`.slice(0, 80),
  };
}
