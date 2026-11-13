import { API_BASE } from '@/lib/api';
import {
  defaultTeamSlaDocument,
  normalizeTeamSlaDocument,
  type TeamSlaDocument,
} from '@/lib/crm/team-sla-profiles';

async function parse(res: Response): Promise<TeamSlaDocument> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('Đăng nhập lại rồi mở trang này.');
    if (res.status === 403) throw new Error('Bạn không có quyền sửa mốc giờ.');
    throw new Error(body || `Không tải được mốc giờ (${res.status})`);
  }
  const json = (await res.json()) as unknown;
  return normalizeTeamSlaDocument(json);
}

function authHeaders(token: string, json = false): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

/** Any authenticated staff — used by the lead-page clocks. */
export async function fetchTeamSlaDocument(token: string): Promise<TeamSlaDocument> {
  const res = await fetch(`${API_BASE}/api/team-sla`, {
    cache: 'no-store',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    // Fall back to defaults rather than blocking the lead page.
    try {
      return await parse(res);
    } catch {
      return defaultTeamSlaDocument();
    }
  }
  return parse(res);
}

/** Admin GET — includes audit fields; same document shape. */
export async function fetchAdminTeamSla(token: string): Promise<TeamSlaDocument> {
  const res = await fetch(`${API_BASE}/api/admin/team-sla`, {
    cache: 'no-store',
    headers: authHeaders(token),
  });
  return parse(res);
}

export async function saveAdminTeamSla(token: string, document: TeamSlaDocument): Promise<TeamSlaDocument> {
  const res = await fetch(`${API_BASE}/api/admin/team-sla`, {
    method: 'PUT',
    cache: 'no-store',
    headers: authHeaders(token, true),
    body: JSON.stringify(document),
  });
  return parse(res);
}
