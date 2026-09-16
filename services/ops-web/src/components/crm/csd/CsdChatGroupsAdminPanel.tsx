'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  addCsdAdminGroupMember,
  approveCsdAdminGroupJoinRequest,
  fetchCsdAdminGroup,
  fetchCsdAdminGroups,
  fetchCsdChatStaffDirectory,
  patchCsdAdminGroup,
  rejectCsdAdminGroupJoinRequest,
  removeCsdAdminGroupMember,
  setCsdAdminGroupMemberRole,
  transferCsdAdminGroupOwner,
  type CsdGroupAdminDetail,
  type CsdGroupAdminListItem,
  type CsdChatStaffDirectoryRow,
} from '@/lib/crm/csd-api';

function roleLabel(role: string): string {
  if (role === 'owner') return 'Chủ';
  if (role === 'admin') return 'Phó';
  if (role === 'viewer') return 'Xem';
  return 'Thành viên';
}

function adminErrorMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : '';
  if (code === 'csd_admin_forbidden') return 'Không có quyền quản trị CSD';
  if (code === 'Not Found' || code.includes('404')) {
    return 'API quản lý nhóm chưa sẵn sàng — thử hard refresh hoặc liên hệ IT restart ptt-crm-api.';
  }
  if (code === 'csd_member_forbidden') return 'Không được phép thao tác thành viên';
  if (code === 'csd_role_forbidden') return 'Không được phép đổi vai trò';
  if (code === 'cannot_remove_owner') return 'Không thể xóa Chủ nhóm';
  if (code === 'conversation_closed') return 'Nhóm đã đóng hoặc lưu trữ';
  return err instanceof Error ? err.message : 'Thao tác thất bại';
}

type CsdChatGroupsAdminPanelProps = {
  token: string;
};

export function CsdChatGroupsAdminPanel({ token }: CsdChatGroupsAdminPanelProps) {
  const [groups, setGroups] = useState<CsdGroupAdminListItem[]>([]);
  const [directory, setDirectory] = useState<CsdChatStaffDirectoryRow[]>([]);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CsdGroupAdminDetail | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [addStaffId, setAddStaffId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const memberIds = useMemo(
    () => new Set((detail?.members ?? []).map((m) => m.member_staff_id)),
    [detail?.members],
  );

  const addCandidates = useMemo(
    () => directory.filter((row) => !memberIds.has(row.staff_id)),
    [directory, memberIds],
  );

  const reloadGroups = useCallback(
    async (query?: string) => {
      const out = await fetchCsdAdminGroups(token, query);
      setGroups(out.items ?? []);
    },
    [token],
  );

  const reloadDetail = useCallback(
    async (conversationId: string) => {
      const out = await fetchCsdAdminGroup(token, conversationId);
      setDetail(out);
      setGroupName(out.conversation.name_vi);
      setGroupDesc(out.conversation.description ?? '');
    },
    [token],
  );

  useEffect(() => {
    void reloadGroups(q).catch((err) => {
      setError(adminErrorMessage(err));
    });
  }, [q, reloadGroups]);

  useEffect(() => {
    void fetchCsdChatStaffDirectory(token)
      .then((out) => setDirectory(out.items ?? []))
      .catch(() => setDirectory([]));
  }, [token]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void reloadDetail(selectedId).catch((err) => {
      setError(adminErrorMessage(err));
    });
  }, [selectedId, reloadDetail]);

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await action();
      setMsg(success);
      await reloadGroups(q);
      if (selectedId) await reloadDetail(selectedId);
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveGroupInfo(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    await runAction(async () => {
      await patchCsdAdminGroup(token, selectedId, {
        name_vi: groupName.trim(),
        description: groupDesc,
      });
    }, 'Đã lưu thông tin nhóm');
  }

  return (
    <div className="csd-chat-groups-admin" data-testid="csd-chat-groups-admin">
      {msg ? <p className="muted">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <input
        className="kpi-input"
        placeholder="Tìm tên nhóm, id, chủ nhóm…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ maxWidth: '24rem', marginBottom: '1rem' }}
        data-testid="csd-chat-groups-admin-search"
      />

      <div className="csd-chat-groups-admin__layout">
        <div className="csd-chat-groups-admin__list">
          <table className="data-table" data-testid="csd-chat-groups-admin-table">
            <thead>
              <tr>
                <th>Nhóm</th>
                <th>Chủ</th>
                <th>TV</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    Không có nhóm
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr
                    key={group.id}
                    className={selectedId === group.id ? 'is-selected' : ''}
                    data-testid={`csd-chat-groups-admin-row-${group.id}`}
                  >
                    <td>
                      <button
                        type="button"
                        className="csd-chat-groups-admin__pick"
                        onClick={() => setSelectedId(group.id)}
                      >
                        {group.name_vi}
                      </button>
                    </td>
                    <td>{group.owner_name || group.owner_staff_id || '—'}</td>
                    <td>{group.member_count}</td>
                    <td>{group.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="csd-chat-groups-admin__detail">
          {!detail ? (
            <p className="muted">Chọn nhóm để quản lý vai trò và cài đặt.</p>
          ) : (
            <>
              <h3>{detail.conversation.name_vi}</h3>
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                ID: {detail.conversation.id}
              </p>

              <form className="stack-gap" onSubmit={(e) => void saveGroupInfo(e)}>
                <label className="csd-chat-context-label" htmlFor="csd-admin-group-name">
                  Tên nhóm
                </label>
                <input
                  id="csd-admin-group-name"
                  className="kpi-input"
                  value={groupName}
                  maxLength={191}
                  onChange={(e) => setGroupName(e.target.value)}
                />
                <label className="csd-chat-context-label" htmlFor="csd-admin-group-desc">
                  Mô tả
                </label>
                <textarea
                  id="csd-admin-group-desc"
                  className="kpi-input"
                  rows={2}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                />
                <div className="csd-chat-zalo-toggles">
                  <label className="csd-chat-zalo-toggle">
                    <span>Cần duyệt khi mời</span>
                    <input
                      type="checkbox"
                      checked={Boolean(detail.conversation.join_approval_required)}
                      disabled={busy}
                      onChange={(e) => {
                        void runAction(async () => {
                          await patchCsdAdminGroup(token, detail.conversation.id, {
                            join_approval_required: e.target.checked,
                          });
                        }, 'Đã cập nhật duyệt mời');
                      }}
                    />
                  </label>
                  <label className="csd-chat-zalo-toggle">
                    <span>Chỉ Chủ/Phó được gửi</span>
                    <input
                      type="checkbox"
                      checked={detail.conversation.members_can_send === false}
                      disabled={busy}
                      onChange={(e) => {
                        void runAction(async () => {
                          await patchCsdAdminGroup(token, detail.conversation.id, {
                            members_can_send: !e.target.checked,
                          });
                        }, 'Đã cập nhật khóa gửi tin');
                      }}
                    />
                  </label>
                </div>
                <button type="submit" className="btn btn-sm" disabled={busy || !groupName.trim()}>
                  Lưu thông tin
                </button>
              </form>

              {detail.join_requests.length > 0 ? (
                <section className="stack-gap" style={{ marginTop: '1rem' }}>
                  <h4>Yêu cầu tham gia</h4>
                  <ul className="csd-chat-members">
                    {detail.join_requests.map((req) => (
                      <li key={req.id}>
                        <span>
                          {req.requester_display_name_vi || `Staff #${req.requester_staff_id}`}
                        </span>
                        <span className="csd-chat-members__actions">
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busy}
                            onClick={() =>
                              void runAction(async () => {
                                await approveCsdAdminGroupJoinRequest(
                                  token,
                                  detail.conversation.id,
                                  req.id,
                                );
                              }, 'Đã duyệt thành viên')
                            }
                          >
                            Duyệt
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            disabled={busy}
                            onClick={() =>
                              void runAction(async () => {
                                await rejectCsdAdminGroupJoinRequest(
                                  token,
                                  detail.conversation.id,
                                  req.id,
                                );
                              }, 'Đã từ chối')
                            }
                          >
                            Từ chối
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="stack-gap" style={{ marginTop: '1rem' }}>
                <h4>Thành viên ({detail.members.length})</h4>
                <ul className="csd-chat-members" data-testid="csd-chat-groups-admin-members">
                  {detail.members.map((member) => {
                    const removable = member.role !== 'owner';
                    return (
                      <li key={member.member_staff_id}>
                        <span className="csd-chat-members__name">
                          {member.display_name_vi || `Staff #${member.member_staff_id}`} ·{' '}
                          {roleLabel(member.role)}
                        </span>
                        <span className="csd-chat-members__actions">
                          {member.role === 'member' || member.role === 'viewer' ? (
                            <button
                              type="button"
                              className="csd-chat-context-link-btn"
                              disabled={busy}
                              onClick={() =>
                                void runAction(async () => {
                                  await setCsdAdminGroupMemberRole(
                                    token,
                                    detail.conversation.id,
                                    member.member_staff_id,
                                    'admin',
                                  );
                                }, 'Đã đặt Phó')
                              }
                            >
                              Đặt phó
                            </button>
                          ) : null}
                          {member.role === 'admin' ? (
                            <button
                              type="button"
                              className="csd-chat-context-link-btn"
                              disabled={busy}
                              onClick={() =>
                                void runAction(async () => {
                                  await setCsdAdminGroupMemberRole(
                                    token,
                                    detail.conversation.id,
                                    member.member_staff_id,
                                    'member',
                                  );
                                }, 'Đã gỡ Phó')
                              }
                            >
                              Gỡ phó
                            </button>
                          ) : null}
                          {member.role !== 'owner' ? (
                            <button
                              type="button"
                              className="csd-chat-context-link-btn"
                              disabled={busy}
                              onClick={() =>
                                void runAction(async () => {
                                  await transferCsdAdminGroupOwner(
                                    token,
                                    detail.conversation.id,
                                    member.member_staff_id,
                                  );
                                }, 'Đã chuyển Chủ nhóm')
                              }
                            >
                              Chuyển chủ
                            </button>
                          ) : null}
                          {removable ? (
                            <button
                              type="button"
                              className="csd-chat-context-link-btn"
                              disabled={busy}
                              onClick={() =>
                                void runAction(async () => {
                                  await removeCsdAdminGroupMember(
                                    token,
                                    detail.conversation.id,
                                    member.member_staff_id,
                                  );
                                }, 'Đã xóa thành viên')
                              }
                            >
                              Xóa
                            </button>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="csd-chat-member-form stack-gap">
                  <label className="csd-chat-context-label" htmlFor="csd-admin-add-member">
                    Thêm thành viên (bỏ qua bạn bè)
                  </label>
                  <select
                    id="csd-admin-add-member"
                    className="kpi-input"
                    value={addStaffId}
                    onChange={(e) => setAddStaffId(e.target.value)}
                  >
                    <option value="">Chọn nhân viên…</option>
                    {addCandidates.map((row) => (
                      <option key={row.staff_id} value={row.staff_id}>
                        {row.staff_name || `Staff #${row.staff_id}`}
                        {row.staff_email ? ` — ${row.staff_email}` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={busy || !addStaffId}
                    onClick={() =>
                      void runAction(async () => {
                        await addCsdAdminGroupMember(token, detail.conversation.id, {
                          member_staff_id: Number(addStaffId),
                        });
                        setAddStaffId('');
                      }, 'Đã thêm thành viên')
                    }
                  >
                    Thêm vào nhóm
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
