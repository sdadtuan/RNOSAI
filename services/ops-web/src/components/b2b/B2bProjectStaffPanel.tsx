'use client';

import { useEffect, useState } from 'react';
import { Form, FormField, FormGrid, FormSection } from '@/components/form';
import { FormSelect } from '@/components/form/FormControls';
import { ApiError } from '@/lib/api';
import {
  addStaffDraft,
  patchStaffDraft,
  removeStaffDraft,
  staffDraftPayload,
  staffRowsToDraft,
  type B2bStaffDraft,
  type B2bStaffLevel,
  type B2bStaffRole,
} from '@/lib/b2b-project-staff-draft';
import {
  fetchB2bLeadEligibleStaff,
  fetchB2bProjectStaff,
  replaceB2bProjectStaff,
  type B2bLeadEligibleStaffRow,
} from '@/lib/b2b-projects-api';
import { b2bStaffPickerOptions } from '@/lib/b2b-staff-picker.util';
import { getAccessToken } from '@/lib/auth';

const ROLES: Array<{ value: B2bStaffRole; label: string }> = [
  { value: 'sales', label: 'Kinh doanh' },
  { value: 'project_manager', label: 'Quản lý dự án' },
];

const LEVELS: B2bStaffLevel[] = ['s', 'a', 'b', 'c'];

function blockMessage(code: string): string {
  if (code === 'inactive') {
    return 'Nhân viên này đang ngưng. Bật lại tài khoản rồi mới thêm vào pool.';
  }
  if (code === 'cannot_receive_leads' || code === 'staff_not_lead_eligible') {
    return 'Nhân viên này chưa bật «Cho phép nhận lead». Bật tại Nhân sự → Nhân viên rồi mới thêm vào pool.';
  }
  return 'Không lưu được pool nhân viên.';
}

function receiveNote(row: B2bStaffDraft): string {
  if (row.active && row.can_receive_leads) return 'Đủ điều kiện nhận lead tự động';
  if (!row.active) return 'Chưa nhận lead tự động — tài khoản đang ngưng';
  return 'Chưa nhận lead tự động — chưa bật «Cho phép nhận lead»';
}

export function B2bProjectStaffPanel({
  projectId,
  canManage,
  onMessage,
  onError,
}: {
  projectId: string;
  canManage: boolean;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<B2bStaffDraft[]>([]);
  const [loadedIds, setLoadedIds] = useState<number[]>([]);
  const [eligible, setEligible] = useState<B2bLeadEligibleStaffRow[]>([]);
  const [pickId, setPickId] = useState('');
  const [pickRole, setPickRole] = useState('');
  const [pickLevel, setPickLevel] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    void Promise.all([fetchB2bProjectStaff(token, projectId), fetchB2bLeadEligibleStaff(token)])
      .then(([staff, people]) => {
        if (cancelled) return;
        const next = staffRowsToDraft(staff);
        setDraft(next);
        setLoadedIds(next.map((row) => row.staff_id));
        setEligible(people);
      })
      .catch((err: unknown) => {
        if (!cancelled) onError(err instanceof Error ? err.message : 'Không tải được nhân viên dự án');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, onError]);

  const draftIds = new Set(draft.map((row) => String(row.staff_id)));
  const addOptions = b2bStaffPickerOptions(eligible, []).filter((opt) => !draftIds.has(opt.value));
  const canAdd = Boolean(pickId && pickRole && pickLevel);

  function fail(code: string) {
    setSaved('');
    const msg = blockMessage(code);
    onError(msg);
  }

  function addPerson() {
    const person = eligible.find((row) => String(row.id) === pickId);
    if (!person || !pickRole || !pickLevel) return;
    try {
      setDraft(
        addStaffDraft(draft, {
          id: person.id,
          name: person.name,
          job_title: person.job_title,
          active: true,
          can_receive_leads: true,
          role: pickRole as B2bStaffRole,
          sales_level: pickLevel as B2bStaffLevel,
        }),
      );
      setPickId('');
      setPickRole('');
      setPickLevel('');
    } catch (err) {
      fail(err instanceof Error ? err.message : '');
    }
  }

  function changeRow(staffId: number, patch: Partial<Pick<B2bStaffDraft, 'assign_enabled' | 'sales_level' | 'role'>>) {
    try {
      setDraft(patchStaffDraft(draft, staffId, patch));
    } catch (err) {
      fail(err instanceof Error ? err.message : '');
    }
  }

  async function save() {
    const token = getAccessToken();
    if (!token) return;
    setBusy(true);
    try {
      const fresh = await fetchB2bLeadEligibleStaff(token);
      const freshIds = new Set(fresh.map((row) => row.id));
      const known = new Set(loadedIds);
      const blocked = draft.find((row) => !known.has(row.staff_id) && !freshIds.has(row.staff_id));
      if (blocked) {
        fail('cannot_receive_leads');
        return;
      }
      await replaceB2bProjectStaff(token, projectId, staffDraftPayload(draft));
      setLoadedIds(draft.map((row) => row.staff_id));
      setEligible(fresh);
      setSaved('Đã lưu nhân viên nhận lead của dự án.');
      onMessage('Đã lưu nhân viên nhận lead của dự án.');
    } catch (err) {
      const code = err instanceof ApiError ? err.message : err instanceof Error ? err.message : '';
      fail(code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-card">
      <Form asDiv>
        <FormSection title="Nhân viên nhận lead">
          <p className="muted">
            Thuộc pool của dự án này. Vai trò và vị trí gắn với dự án. Muốn nhận lead tự động, nhân viên phải đang
            hoạt động và đã bật «Cho phép nhận lead».
          </p>
          {canManage ? (
            <FormGrid cols={2}>
              <FormField label="Nhân viên">
                <FormSelect value={pickId} onChange={(e) => setPickId(e.target.value)}>
                  <option value="">Chọn nhân viên</option>
                  {addOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="Vai trò">
                <FormSelect value={pickRole} onChange={(e) => setPickRole(e.target.value)}>
                  <option value="">Chọn vai trò</option>
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="Vị trí">
                <FormSelect value={pickLevel} onChange={(e) => setPickLevel(e.target.value)}>
                  <option value="">Chọn vị trí</option>
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level.toUpperCase()}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label=" ">
                <button type="button" className="btn btn-secondary btn-sm" disabled={!canAdd || busy} onClick={addPerson}>
                  Thêm vào dự án
                </button>
              </FormField>
            </FormGrid>
          ) : null}
          {loading ? <p className="muted">Đang tải nhân viên…</p> : null}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Chức danh</th>
                  <th>Vai trò</th>
                  <th>Vị trí</th>
                  <th>Nhận lead của dự án</th>
                  <th>Ghi chú</th>
                  {canManage ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {draft.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={canManage ? 7 : 6}>Chưa có nhân viên trong pool dự án này.</td>
                  </tr>
                ) : null}
                {draft.map((row) => (
                  <tr key={row.staff_id}>
                    <td>{row.name || `NV #${row.staff_id}`}</td>
                    <td>{row.job_title || '—'}</td>
                    <td>
                      {canManage ? (
                        <FormSelect
                          value={row.role}
                          onChange={(e) => changeRow(row.staff_id, { role: e.target.value as B2bStaffRole })}
                        >
                          {ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </FormSelect>
                      ) : (
                        ROLES.find((role) => role.value === row.role)?.label
                      )}
                    </td>
                    <td>
                      {canManage ? (
                        <FormSelect
                          value={row.sales_level}
                          onChange={(e) => changeRow(row.staff_id, { sales_level: e.target.value as B2bStaffLevel })}
                        >
                          {LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {level.toUpperCase()}
                            </option>
                          ))}
                        </FormSelect>
                      ) : (
                        row.sales_level.toUpperCase()
                      )}
                    </td>
                    <td>
                      {canManage ? (
                        <input
                          type="checkbox"
                          checked={row.assign_enabled}
                          onChange={(e) => changeRow(row.staff_id, { assign_enabled: e.target.checked })}
                        />
                      ) : row.assign_enabled ? (
                        'Có'
                      ) : (
                        'Không'
                      )}
                    </td>
                    <td>{receiveNote(row)}</td>
                    {canManage ? (
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDraft((rows) => removeStaffDraft(rows, row.staff_id))}
                        >
                          Gỡ
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canManage ? (
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || loading} onClick={() => void save()}>
              {busy ? 'Đang lưu…' : 'Lưu pool'}
            </button>
          ) : null}
          {saved ? <p className="delivery-notice">{saved}</p> : null}
        </FormSection>
      </Form>
    </div>
  );
}
