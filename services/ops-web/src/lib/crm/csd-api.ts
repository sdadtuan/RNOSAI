import { API_BASE, ApiError, parseJson } from '@/lib/api';

export const CSD_TICKET_STATUSES = [
  'draft',
  'new',
  'triaged',
  'assigned',
  'in_progress',
  'waiting_for_client',
  'waiting_for_internal_approval',
  'on_hold',
  'resolved',
  'client_acceptance',
  'closed',
  'cancelled',
  'rejected',
  'reopened',
  'escalated',
] as const;

export type CsdTicketStatus = (typeof CSD_TICKET_STATUSES)[number];
export type CsdPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type CsdSlaStatus = 'on_track' | 'at_risk' | 'near_breach' | 'breached' | 'paused';
export type CsdCommentVisibility = 'public' | 'internal';

export interface CsdTicketRow {
  id: string;
  code: string;
  title: string;
  description: string;
  ticket_type: string;
  status: CsdTicketStatus;
  priority: CsdPriority;
  sla_status: CsdSlaStatus;
  scope_status?: string;
  assignee_staff_id: number | null;
  assignee_staff_name?: string | null;
  owner_staff_id?: number | null;
  client_account_id?: string | null;
  client_account_name?: string | null;
  sla_resolution_due_at?: string | null;
  sla_response_due_at?: string | null;
  resolution_note?: string;
  source_type?: string;
  source_id?: string | null;
  created_at: string;
  updated_at: string;
  skipped_internal_files?: string[];
  already_exists?: boolean;
}

export interface CsdTicketCommentRow {
  id: string;
  ticket_id: string;
  visibility: CsdCommentVisibility;
  body_text: string;
  author_staff_id: number | null;
  author_staff_name?: string | null;
  created_at: string;
}

export interface CsdTicketActivityRow {
  id: string;
  action: string;
  body_vi?: string;
  actor_staff_name?: string | null;
  created_at: string;
}

export interface CreateCsdTicketInput {
  title: string;
  description?: string;
  ticket_type: string;
  priority: CsdPriority;
  client_account_id?: string;
  customer_id?: number | null;
  source_type?: 'manual' | 'chat_message' | 'email' | 'form' | 'ai_draft';
  source_id?: string | null;
  assignee_staff_id?: number | null;
  idempotency_key?: string;
}

export interface CsdDashboardPayload {
  need_action: number;
  sla_risk: number;
  reports_due: number;
  inbox_waiting: number;
  top_tickets: CsdTicketRow[];
}

export type CsdConversationKind =
  | 'direct'
  | 'group'
  | 'client'
  | 'project'
  | 'announcement'
  | 'campaign'
  | 'ticket'
  | 'ai_assist'
  | 'internal';

export type CsdConversationListFilter =
  | 'all'
  | 'unread'
  | 'clients'
  | 'projects'
  | 'internal'
  | 'mentions';

export interface CsdConversationRow {
  id: string;
  kind: CsdConversationKind;
  status?: 'active' | 'archived' | 'closed' | 'reopened';
  name_vi: string;
  alias_vi?: string | null;
  client_account_id?: string | null;
  project_ref_kind?: string | null;
  project_ref_id?: string | null;
  owner_staff_id?: number | null;
  last_message_at?: string | null;
  preview?: string | null;
  unread_count?: number;
  has_p1_or_complaint?: boolean;
}

export interface CreateCsdConversationInput {
  kind: CsdConversationKind;
  name_vi: string;
  client_account_id?: string;
  project_ref_kind?: string;
  project_ref_id?: string;
  member_staff_ids?: number[];
}

export interface CsdConversationMemberRow {
  conversation_id: string;
  member_type: 'staff';
  member_staff_id: number;
  role: 'owner' | 'member' | 'viewer';
  created_at: string;
  display_name_vi?: string | null;
}

export interface CsdAttachmentRow {
  id: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  visibility: 'internal' | 'client' | 'restricted';
}

export type CsdChatEmotionId = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export interface CsdMessageReactionSummary {
  emotion: CsdChatEmotionId;
  count: number;
  mine: boolean;
}

export interface CsdMessageRow {
  id: string;
  conversation_id: string;
  body_text: string;
  visibility: 'client' | 'internal';
  author_staff_id: number | null;
  author_staff_name?: string | null;
  author_has_avatar?: boolean;
  author_avatar_updated_at?: string | null;
  reply_to_id?: string | null;
  ticket_id?: string | null;
  ticket_code?: string | null;
  created_at: string;
  edited_at?: string | null;
  is_deleted?: boolean;
  delivery_status?: 'sent' | 'delivered' | 'failed';
  attachments?: CsdAttachmentRow[];
  reactions?: CsdMessageReactionSummary[];
  priority_suggestion?: 'P1' | 'P2' | null;
}

export interface CsdEmailRow {
  id: string;
  direction: 'inbound' | 'outbound';
  subject: string;
  from_address: string;
  to_addresses: string[];
  snippet: string;
  ticket_id?: string | null;
  ticket_code?: string | null;
  matched: boolean;
  received_at: string;
}

export const CSD_REPORT_STATUSES = [
  'draft',
  'data_pending',
  'in_review',
  'changes_requested',
  'approved',
  'scheduled',
  'sent',
  'viewed',
  'acknowledged',
  'archived',
  'cancelled',
] as const;

export type CsdReportStatus = (typeof CSD_REPORT_STATUSES)[number];
export type CsdReportListFilter = 'all' | 'due' | 'in_review' | 'sent';

export const CSD_REPORT_TEMPLATES = [
  { value: 'weekly_ops', label: 'Báo cáo vận hành tuần' },
  { value: 'monthly_marketing', label: 'Báo cáo marketing tháng' },
  { value: 'monthly_sla', label: 'Báo cáo ticket/SLA tháng' },
  { value: 'executive', label: 'Báo cáo điều hành' },
] as const;

export const CSD_REPORT_STATUS_LABELS: Record<CsdReportStatus, string> = {
  draft: 'Nháp',
  data_pending: 'Chờ dữ liệu',
  in_review: 'Chờ duyệt',
  changes_requested: 'Yêu cầu sửa',
  approved: 'Đã duyệt',
  scheduled: 'Đã lên lịch',
  sent: 'Đã gửi',
  viewed: 'Đã xem',
  acknowledged: 'Đã xác nhận',
  archived: 'Lưu trữ',
  cancelled: 'Đã huỷ',
};

export interface CsdReportRow {
  id: string;
  template_code: string | null;
  template_name_vi?: string | null;
  title?: string;
  client_account_id: string | null;
  client_account_name?: string | null;
  period_start: string;
  period_end: string;
  status: CsdReportStatus;
  version?: string;
  current_version?: string;
  requires_approval?: boolean;
  updated_at: string;
}

export interface CsdReportVersionRow {
  id: string;
  version: string;
  changelog?: string;
  created_at: string;
  created_by_staff_id?: number | null;
}

export interface CsdReportSendLogRow {
  id: string;
  version: string;
  channel?: string;
  to_json?: string[];
  result: string;
  created_at: string;
}

export interface CsdReportDetail extends CsdReportRow {
  sections_json: Record<string, unknown>;
  template_sections?: string[];
  versions?: CsdReportVersionRow[];
  send_logs?: CsdReportSendLogRow[];
  approver_staff_id?: number | null;
  sent_at?: string | null;
}

export interface CsdReportCommentRow {
  id: string;
  report_id: string;
  version: string;
  section_key: string;
  body_text: string;
  created_at: string;
  created_by_staff_id: number;
  resolved_at: string | null;
}

export interface CsdReportTemplateRow {
  id: string;
  tenant_id?: string;
  code: string;
  name_vi: string;
  requires_approval: boolean;
  sections_json: string[];
  active: boolean;
  created_at?: string;
}

export type CsdReportBlock =
  | { type: 'rich_text'; body: string }
  | { type: 'kpi_table'; rows: { metric: string; value: string; target?: string; note?: string }[] }
  | { type: 'chart'; title: string; labels: string[]; values: number[] }
  | { type: 'file'; attachment_id: string; caption?: string }
  | { type: 'ticket_rollup'; ticket_ids: string[]; summary: string };

export type CsdReportSection = { blocks: CsdReportBlock[] };

export function normalizeCsdReportSection(raw: unknown): CsdReportSection {
  if (raw && typeof raw === 'object' && Array.isArray((raw as CsdReportSection).blocks)) {
    return raw as CsdReportSection;
  }
  if (raw && typeof raw === 'object' && 'body' in (raw as { body?: unknown })) {
    return { blocks: [{ type: 'rich_text', body: String((raw as { body: string }).body ?? '') }] };
  }
  return { blocks: [{ type: 'rich_text', body: '' }] };
}

export interface CreateCsdReportInput {
  template_code: string;
  client_account_id?: string;
  period_start: string;
  period_end: string;
  title?: string;
}

export interface TransitionCsdReportInput {
  to: CsdReportStatus;
  comment?: string;
  approver_staff_id?: number;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function csdFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(authHeaders(token) as Record<string, string>),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'CSD request failed', res.status);
  }
  return body;
}

export async function fetchCsdTickets(
  token: string,
  query: Record<string, string> = {},
): Promise<{ items: CsdTicketRow[]; next_cursor: string | null }> {
  const params = new URLSearchParams(query);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return csdFetch(token, `/api/crm/csd/tickets${suffix}`);
}

export async function createCsdTicket(token: string, body: CreateCsdTicketInput): Promise<CsdTicketRow> {
  return csdFetch(token, '/api/crm/csd/tickets', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCsdTicket(token: string, id: string): Promise<CsdTicketRow> {
  return csdFetch(token, `/api/crm/csd/tickets/${id}`);
}

export async function postCsdComment(
  token: string,
  id: string,
  body: { visibility: CsdCommentVisibility; body_text: string; attachment_ids?: string[] },
): Promise<CsdTicketCommentRow> {
  return csdFetch(token, `/api/crm/csd/tickets/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function assignCsdTicket(
  token: string,
  id: string,
  assigneeStaffId: number,
): Promise<CsdTicketRow> {
  return csdFetch(token, `/api/crm/csd/tickets/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assignee_staff_id: assigneeStaffId }),
  });
}

export async function changeCsdTicketStatus(
  token: string,
  id: string,
  status: CsdTicketStatus,
): Promise<CsdTicketRow> {
  return csdFetch(token, `/api/crm/csd/tickets/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function resolveCsdTicket(
  token: string,
  id: string,
  body: { resolution_note: string; send_public?: boolean },
): Promise<CsdTicketRow> {
  return csdFetch(token, `/api/crm/csd/tickets/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchCsdTicketActivities(
  token: string,
  id: string,
): Promise<{ items: CsdTicketActivityRow[] }> {
  return csdFetch(token, `/api/crm/csd/tickets/${id}/activities`);
}

export async function fetchCsdTicketComments(
  token: string,
  id: string,
): Promise<{ items: CsdTicketCommentRow[] }> {
  return csdFetch(token, `/api/crm/csd/tickets/${id}/comments`);
}

export async function fetchCsdDashboard(token: string): Promise<CsdDashboardPayload> {
  return csdFetch(token, '/api/crm/csd/dashboard');
}

export async function fetchCsdConversations(
  token: string,
  query: {
    filter?: CsdConversationListFilter;
    q?: string;
    kind?: CsdConversationKind;
    client_account_id?: string;
  } | Record<string, string> = {},
): Promise<{ items: CsdConversationRow[] }> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, String(value));
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return csdFetch(token, `/api/crm/csd/conversations${suffix}`);
}

export async function createCsdConversation(
  token: string,
  body: CreateCsdConversationInput,
): Promise<CsdConversationRow> {
  return csdFetch(token, '/api/crm/csd/conversations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchCsdConversationAlias(
  token: string,
  conversationId: string,
  aliasVi: string,
): Promise<CsdConversationRow> {
  return csdFetch(token, `/api/crm/csd/conversations/${conversationId}/alias`, {
    method: 'PATCH',
    body: JSON.stringify({ alias_vi: aliasVi }),
  });
}

export async function markCsdConversationRead(
  token: string,
  conversationId: string,
): Promise<{ read: true }> {
  return csdFetch(token, `/api/crm/csd/conversations/${conversationId}/read`, {
    method: 'POST',
    body: '{}',
  });
}

export async function fetchCsdMessages(
  token: string,
  conversationId: string,
  after?: string,
  q?: string,
): Promise<{ items: CsdMessageRow[]; me_staff_id?: number }> {
  const params = new URLSearchParams();
  if (after) params.set('after', after);
  if (q && q.trim().length >= 2) params.set('q', q.trim());
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return csdFetch(token, `/api/crm/csd/conversations/${conversationId}/messages${suffix}`);
}

export async function fetchCsdStaffAvatarBlob(token: string, staffId: number): Promise<Blob | null> {
  const res = await fetch(`${API_BASE}/api/crm/csd/staff/${staffId}/avatar`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await parseJson<{ error?: string }>(res);
    throw new ApiError(body.error ?? 'Không tải ảnh', res.status);
  }
  return res.blob();
}

export async function fetchCsdRelatedTickets(
  token: string,
  conversationId: string,
): Promise<{ items: CsdTicketRow[] }> {
  return csdFetch(token, `/api/crm/csd/conversations/${conversationId}/related-tickets`);
}

export async function sendCsdMessage(
  token: string,
  conversationId: string,
  body: { body_text: string; reply_to_id?: string; attachment_ids?: string[] },
): Promise<CsdMessageRow> {
  return csdFetch(token, `/api/crm/csd/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function uploadCsdConversationFile(
  token: string,
  conversationId: string,
  file: File,
): Promise<CsdAttachmentRow> {
  const form = new FormData();
  form.append('file', file);
  return csdFetch(token, `/api/crm/csd/conversations/${conversationId}/files`, {
    method: 'POST',
    body: form,
  });
}

export async function previewCsdFileObjectUrl(token: string, fileId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/crm/csd/files/${fileId}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await parseJson<{ error?: string; message?: string }>(res);
    throw new ApiError(body.error ?? body.message ?? 'Tải file thất bại', res.status);
  }
  return URL.createObjectURL(await res.blob());
}

export async function downloadCsdFile(token: string, fileId: string, fileName: string): Promise<void> {
  const url = await previewCsdFileObjectUrl(token, fileId);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function editCsdMessage(
  token: string,
  messageId: string,
  bodyText: string,
): Promise<CsdMessageRow> {
  return csdFetch(token, `/api/crm/csd/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ body_text: bodyText }),
  });
}

export async function deleteCsdMessage(token: string, messageId: string): Promise<CsdMessageRow> {
  return csdFetch(token, `/api/crm/csd/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export async function reactCsdMessage(
  token: string,
  messageId: string,
  emotion: CsdChatEmotionId,
): Promise<{ message_id: string; reactions: CsdMessageReactionSummary[] }> {
  return csdFetch(token, `/api/crm/csd/messages/${messageId}/reactions`, {
    method: 'PUT',
    body: JSON.stringify({ emotion }),
  });
}

export interface CsdNotificationRow {
  id: string;
  event_key: string;
  title_vi: string;
  body_vi: string;
  entity_type?: string | null;
  entity_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

export async function fetchCsdChatUnreadCount(token: string): Promise<{ count: number }> {
  return csdFetch(token, '/api/crm/csd/chat/unread-count');
}

export type CsdChatMe = {
  staff_id: number;
  enabled: boolean;
  display_name_vi: string | null;
  username: string | null;
  has_password: boolean;
};

export type CsdChatAccountAdminRow = {
  staff_id: number;
  enabled: boolean;
  display_name_vi: string | null;
  username?: string | null;
  has_password?: boolean;
  staff_name: string;
  staff_email: string;
  created_by_staff_id: number;
};

export async function fetchCsdChatMe(token: string): Promise<CsdChatMe> {
  return csdFetch(token, '/api/crm/csd/chat/me');
}

export async function loginCsdChat(
  token: string,
  body: { username: string; password: string },
): Promise<{ ok: true; staff_id: number; username: string }> {
  return csdFetch(token, '/api/crm/csd/chat/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type CsdChatStaffDirectoryRow = {
  staff_id: number;
  staff_name: string;
  staff_email: string;
  position_id: number | null;
  has_login: boolean;
};

export async function fetchCsdChatAccountsAdmin(
  token: string,
  q?: string,
): Promise<{ items: CsdChatAccountAdminRow[] }> {
  const suffix = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return csdFetch(token, `/api/crm/csd/admin/chat-accounts${suffix}`);
}

export async function fetchCsdChatStaffDirectory(
  token: string,
): Promise<{ items: CsdChatStaffDirectoryRow[] }> {
  return csdFetch(token, '/api/crm/csd/admin/chat-accounts/directory');
}

export async function upsertCsdChatAccount(
  token: string,
  body: {
    staff_id: number;
    enabled: boolean;
    display_name_vi?: string;
    username?: string;
    chat_password?: string;
  },
): Promise<CsdChatAccountAdminRow> {
  return csdFetch(token, '/api/crm/csd/admin/chat-accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type CsdChatFriendshipStatus = 'pending' | 'accepted' | 'blocked';

export type CsdChatFriendshipRow = {
  id: string;
  requester_staff_id: number;
  addressee_staff_id: number;
  status: CsdChatFriendshipStatus;
};

export type CsdChatPersonRow = {
  staff_id: number;
  display_name_vi: string;
};

export async function fetchCsdChatPeople(
  token: string,
  q: string,
): Promise<{ items: CsdChatPersonRow[] }> {
  const suffix = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return csdFetch(token, `/api/crm/csd/chat/people${suffix}`);
}

export async function fetchCsdChatFriends(token: string): Promise<{ items: CsdChatPersonRow[] }> {
  return csdFetch(token, '/api/crm/csd/chat/friends');
}

export async function fetchCsdChatFriendRequests(
  token: string,
): Promise<{ incoming: CsdChatFriendshipRow[]; outgoing: CsdChatFriendshipRow[] }> {
  return csdFetch(token, '/api/crm/csd/chat/friends/requests');
}

export async function requestCsdChatFriend(token: string, staffId: number): Promise<CsdChatFriendshipRow> {
  return csdFetch(token, '/api/crm/csd/chat/friends', {
    method: 'POST',
    body: JSON.stringify({ staff_id: staffId }),
  });
}

export async function acceptCsdChatFriend(token: string, id: string): Promise<CsdChatFriendshipRow> {
  return csdFetch(token, `/api/crm/csd/chat/friends/${id}/accept`, { method: 'POST', body: '{}' });
}

export async function rejectCsdChatFriend(token: string, id: string): Promise<{ deleted: true }> {
  return csdFetch(token, `/api/crm/csd/chat/friends/${id}/reject`, { method: 'POST', body: '{}' });
}

export async function deleteCsdChatFriend(token: string, id: string): Promise<{ deleted: true }> {
  return csdFetch(token, `/api/crm/csd/chat/friends/${id}`, { method: 'DELETE' });
}

export async function blockCsdChatFriend(token: string, id: string): Promise<CsdChatFriendshipRow> {
  return csdFetch(token, `/api/crm/csd/chat/friends/${id}/block`, { method: 'POST', body: '{}' });
}

export async function fetchCsdNotifications(
  token: string,
  unreadOnly = false,
): Promise<{ items: CsdNotificationRow[] }> {
  const suffix = unreadOnly ? '?unread=1' : '';
  return csdFetch(token, `/api/crm/csd/notifications${suffix}`);
}

export async function markCsdNotificationRead(token: string, id: string): Promise<{ read: true }> {
  return csdFetch(token, `/api/crm/csd/notifications/${id}/read`, { method: 'POST', body: '{}' });
}

export async function archiveCsdConversation(
  token: string,
  conversationId: string,
): Promise<CsdConversationRow> {
  return csdFetch(token, `/api/crm/csd/conversations/${conversationId}/archive`, {
    method: 'POST',
    body: '{}',
  });
}

export async function forwardCsdMessage(
  token: string,
  targetConversationId: string,
  messageId: string,
): Promise<CsdMessageRow> {
  return csdFetch(token, `/api/crm/csd/conversations/${targetConversationId}/forward`, {
    method: 'POST',
    body: JSON.stringify({ message_id: messageId }),
  });
}

export async function createCsdTicketFromAiAction(
  token: string,
  aiInteractionId: string,
  actionIndex: number,
  patch: Partial<CreateCsdTicketInput>,
): Promise<CsdTicketRow & { already_exists?: boolean }> {
  return csdFetch(
    token,
    `/api/crm/csd/ai/interactions/${aiInteractionId}/actions/${actionIndex}/create-ticket`,
    { method: 'POST', body: JSON.stringify(patch) },
  );
}

export async function createCsdTicketFromMessage(
  token: string,
  messageId: string,
  patch: Partial<CreateCsdTicketInput>,
): Promise<CsdTicketRow & { skipped_internal_files?: string[]; already_exists?: boolean }> {
  return csdFetch(token, `/api/crm/csd/messages/${messageId}/create-ticket`, {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}

export async function fetchCsdConversationMembers(
  token: string,
  conversationId: string,
): Promise<{ items: CsdConversationMemberRow[] }> {
  return csdFetch(token, `/api/crm/csd/conversations/${conversationId}/members`);
}

export async function addCsdConversationMember(
  token: string,
  conversationId: string,
  body: { member_staff_id: number; role?: CsdConversationMemberRow['role'] },
): Promise<CsdConversationMemberRow> {
  return csdFetch(token, `/api/crm/csd/conversations/${conversationId}/members`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function removeCsdConversationMember(
  token: string,
  conversationId: string,
  staffId: number,
): Promise<void> {
  await csdFetch(token, `/api/crm/csd/conversations/${conversationId}/members/${staffId}`, {
    method: 'DELETE',
  });
}

export async function closeCsdConversation(
  token: string,
  conversationId: string,
): Promise<CsdConversationRow> {
  return csdFetch(token, `/api/crm/csd/conversations/${conversationId}/close`, {
    method: 'POST',
    body: '{}',
  });
}

export async function reopenCsdConversation(
  token: string,
  conversationId: string,
): Promise<CsdConversationRow> {
  return csdFetch(token, `/api/crm/csd/conversations/${conversationId}/reopen`, {
    method: 'POST',
    body: '{}',
  });
}

export async function fetchCsdEmails(
  token: string,
  query: Record<string, string> = {},
): Promise<{ items: CsdEmailRow[] }> {
  const params = new URLSearchParams(query);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return csdFetch(token, `/api/crm/csd/emails${suffix}`);
}

export async function fetchCsdUnmatchedEmails(token: string): Promise<{ items: CsdEmailRow[] }> {
  return csdFetch(token, '/api/crm/csd/emails/unmatched');
}

export async function sendCsdEmail(
  token: string,
  body: { to: string[]; subject: string; body_text: string; ticket_id?: string },
): Promise<{ id: string; status: string }> {
  return csdFetch(token, '/api/crm/csd/emails/send', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchCsdReports(
  token: string,
  query: Record<string, string> = {},
): Promise<{ items: CsdReportRow[] }> {
  const params = new URLSearchParams(query);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return csdFetch(token, `/api/crm/csd/reports${suffix}`);
}

export async function createCsdReport(token: string, body: CreateCsdReportInput): Promise<CsdReportRow> {
  return csdFetch(token, '/api/crm/csd/reports', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCsdReport(token: string, id: string): Promise<CsdReportDetail> {
  return csdFetch(token, `/api/crm/csd/reports/${id}`);
}

export async function transitionCsdReport(
  token: string,
  id: string,
  body: TransitionCsdReportInput,
): Promise<CsdReportDetail> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/transition`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateCsdReportSections(
  token: string,
  id: string,
  sectionsJson: Record<string, unknown>,
): Promise<{ version: string; sections_json: Record<string, unknown> }> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/sections`, {
    method: 'PATCH',
    body: JSON.stringify({ sections_json: sectionsJson }),
  });
}

export async function submitCsdReportReview(
  token: string,
  id: string,
  approverStaffId?: number,
): Promise<CsdReportDetail> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/submit-review`, {
    method: 'POST',
    body: JSON.stringify(approverStaffId != null ? { approver_staff_id: approverStaffId } : {}),
  });
}

export async function approveCsdReport(token: string, id: string): Promise<CsdReportDetail> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/approve`, { method: 'POST', body: '{}' });
}

export async function requestCsdReportChanges(
  token: string,
  id: string,
  comment: string,
): Promise<CsdReportDetail> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/request-changes`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export async function sendCsdReport(
  token: string,
  id: string,
  body: { to: string[]; subject: string; body: string; schedule_at?: string },
): Promise<{ status: string; result?: string }> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/send`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function retryCsdReportSend(token: string, id: string): Promise<{ status: string; result?: string }> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/retry-send`, {
    method: 'POST',
    body: '{}',
  });
}

export async function shareCsdReportToChat(
  token: string,
  id: string,
  conversationId: string,
): Promise<{ message_id: string }> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/share-chat`, {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

export async function snapshotCsdReportVersion(
  token: string,
  id: string,
  body: { kind: 'minor' | 'major'; changelog: string },
): Promise<CsdReportDetail> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/versions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function reviseCsdReport(token: string, id: string): Promise<CsdReportRow> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/revise`, { method: 'POST', body: '{}' });
}

export async function rollupCsdReportTickets(
  token: string,
  id: string,
): Promise<{ version: string; sections_json: Record<string, unknown> }> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/rollup`, { method: 'POST', body: '{}' });
}

export async function uploadCsdReportFile(
  token: string,
  reportId: string,
  file: File,
): Promise<CsdAttachmentRow> {
  const form = new FormData();
  form.append('file', file);
  return csdFetch(token, `/api/crm/csd/reports/${reportId}/files`, {
    method: 'POST',
    body: form,
  });
}

async function downloadCsdBinary(token: string, path: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await parseJson<{ error?: string; message?: string }>(res);
    throw new ApiError(body.error ?? body.message ?? 'Tải file thất bại', res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  link.download = match?.[1] || fallbackFilename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchCsdReportComments(
  token: string,
  id: string,
  sectionKey?: string,
): Promise<{ items: CsdReportCommentRow[] }> {
  const suffix = sectionKey != null ? `?section_key=${encodeURIComponent(sectionKey)}` : '';
  return csdFetch(token, `/api/crm/csd/reports/${id}/comments${suffix}`);
}

export async function addCsdReportComment(
  token: string,
  id: string,
  body: { section_key: string; body_text: string },
): Promise<CsdReportCommentRow> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function resolveCsdReportComment(
  token: string,
  id: string,
  commentId: string,
): Promise<CsdReportCommentRow> {
  return csdFetch(token, `/api/crm/csd/reports/${id}/comments/${commentId}/resolve`, {
    method: 'POST',
    body: '{}',
  });
}

export async function fetchCsdReportTemplates(token: string): Promise<{ items: CsdReportTemplateRow[] }> {
  return csdFetch(token, '/api/crm/csd/reports/templates');
}

export async function createCsdReportTemplate(
  token: string,
  body: { code: string; name_vi: string; requires_approval?: boolean; sections_json: string[] },
): Promise<CsdReportTemplateRow> {
  return csdFetch(token, '/api/crm/csd/reports/templates', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateCsdReportTemplate(
  token: string,
  id: string,
  body: { name_vi?: string; requires_approval?: boolean; sections_json?: string[] },
): Promise<CsdReportTemplateRow> {
  return csdFetch(token, `/api/crm/csd/reports/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function archiveCsdReportTemplate(token: string, id: string): Promise<CsdReportTemplateRow> {
  return csdFetch(token, `/api/crm/csd/reports/templates/${id}/archive`, {
    method: 'POST',
    body: '{}',
  });
}

export async function exportCsdReportPdf(token: string, id: string): Promise<void> {
  await downloadCsdBinary(token, `/api/crm/csd/reports/${id}/export.pdf`, `PTT-report.pdf`);
}

export async function exportCsdReportXlsx(token: string, id: string): Promise<void> {
  await downloadCsdBinary(token, `/api/crm/csd/reports/${id}/export.xlsx`, `PTT-report.xlsx`);
}

export async function draftCsdTicketReply(
  token: string,
  ticketId: string,
): Promise<{ body_text: string }> {
  return csdFetch(token, `/api/crm/csd/ai/tickets/${ticketId}/draft-reply`, { method: 'POST', body: '{}' });
}

export async function draftCsdChatSummary(
  token: string,
  conversationId: string,
  period: '24h' | '7d' | 'all' = '24h',
): Promise<{
  summary: string;
  decisions: string[];
  actions: string[];
  risks: string[];
  ai_interaction_id?: string;
}> {
  return csdFetch(token, `/api/crm/csd/ai/conversations/${conversationId}/summarize`, {
    method: 'POST',
    body: JSON.stringify({ period }),
  });
}

export const CSD_STATUS_LABELS: Record<CsdTicketStatus, string> = {
  draft: 'Nháp',
  new: 'Mới',
  triaged: 'Đã phân loại',
  assigned: 'Đã gán',
  in_progress: 'Đang xử lý',
  waiting_for_client: 'Chờ khách',
  waiting_for_internal_approval: 'Chờ duyệt nội bộ',
  on_hold: 'Tạm dừng',
  resolved: 'Đã xử lý',
  client_acceptance: 'Chờ khách xác nhận',
  closed: 'Đóng',
  cancelled: 'Huỷ',
  rejected: 'Từ chối',
  reopened: 'Mở lại',
  escalated: 'Leo thang',
};

export const CSD_PRIORITY_LABELS: Record<CsdPriority, string> = {
  P1: 'P1 — Khẩn',
  P2: 'P2 — Cao',
  P3: 'P3 — Trung bình',
  P4: 'P4 — Thấp',
};

export const CSD_SLA_LABELS: Record<CsdSlaStatus, string> = {
  on_track: 'Đúng hạn',
  at_risk: 'Có rủi ro',
  near_breach: 'Sắp trễ',
  breached: 'Trễ SLA',
  paused: 'Tạm dừng SLA',
};

export const CSD_TICKET_TYPES = [
  { value: 'incident', label: 'Sự cố' },
  { value: 'request', label: 'Yêu cầu' },
  { value: 'change', label: 'Thay đổi' },
  { value: 'question', label: 'Câu hỏi' },
  { value: 'report', label: 'Báo cáo' },
];

export function formatCsdWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
