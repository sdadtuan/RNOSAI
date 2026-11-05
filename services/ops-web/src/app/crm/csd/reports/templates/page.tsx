'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';
import {
  archiveCsdReportTemplate,
  createCsdReportTemplate,
  fetchCsdReportTemplates,
  updateCsdReportTemplate,
  type CsdReportTemplateRow,
} from '@/lib/crm/csd-api';

function sectionsToText(sections: string[]): string {
  return sections.join(', ');
}

function textToSections(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type Draft = {
  name_vi: string;
  requires_approval: boolean;
  sections_text: string;
};

export default function CsdReportTemplatesPage() {
  const { user, token, error, setError, logout, canManage } = useCsdPageAuth('manage');
  const [items, setItems] = useState<CsdReportTemplateRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: '',
    name_vi: '',
    requires_approval: true,
    sections_text: 'cover, executive_summary, risks',
  });

  const reload = useCallback(async () => {
    if (!token) return;
    const out = await fetchCsdReportTemplates(token);
    const rows = out.items ?? [];
    setItems(rows);
    setDrafts(
      Object.fromEntries(
        rows.map((row) => [
          row.id,
          {
            name_vi: row.name_vi,
            requires_approval: row.requires_approval,
            sections_text: sectionsToText(row.sections_json ?? []),
          },
        ]),
      ),
    );
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void reload().catch((err) => {
      setError(err instanceof Error ? err.message : 'Tải mẫu báo cáo thất bại');
    });
  }, [token, reload, setError]);

  function patchDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function saveRow(row: CsdReportTemplateRow) {
    if (!token) return;
    const draft = drafts[row.id];
    if (!draft) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await updateCsdReportTemplate(token, row.id, {
        name_vi: draft.name_vi.trim(),
        requires_approval: draft.requires_approval,
        sections_json: textToSections(draft.sections_text),
      });
      await reload();
      setMsg(`Đã lưu mẫu ${row.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu mẫu thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function archiveRow(row: CsdReportTemplateRow) {
    if (!token) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await archiveCsdReportTemplate(token, row.id);
      await reload();
      setMsg(`Đã lưu trữ mẫu ${row.code} — không xóa dữ liệu`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu trữ mẫu thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await createCsdReportTemplate(token, {
        code: createForm.code.trim(),
        name_vi: createForm.name_vi.trim(),
        requires_approval: createForm.requires_approval,
        sections_json: textToSections(createForm.sections_text),
      });
      setCreateOpen(false);
      setCreateForm({
        code: '',
        name_vi: '',
        requires_approval: true,
        sections_text: 'cover, executive_summary, risks',
      });
      await reload();
      setMsg('Đã tạo mẫu mới');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo mẫu thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Service Desk', href: '/crm/csd' },
        { label: 'Báo cáo', href: '/crm/csd/reports' },
        { label: 'Mẫu báo cáo' },
      ]}
    >
      <PageToolbar
        title="Mẫu báo cáo"
        subtitle="Sửa tên · mục · duyệt. Lưu trữ ẩn mẫu, không xóa."
        actions={
          canManage ? (
            <button
              type="button"
              className="btn btn-sm"
              data-testid="csd-report-template-new"
              onClick={() => setCreateOpen((open) => !open)}
            >
              Thêm mẫu
            </button>
          ) : null
        }
      />
      <div className="page-card stack-gap" data-testid="csd-report-templates">
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}

        {createOpen ? (
          <form onSubmit={(e) => void handleCreate(e)} className="admin-crm-form">
            <h3 className="kpi-section-title">Thêm mẫu</h3>
            <div className="admin-crm-form__grid">
              <input
                className="kpi-input"
                required
                placeholder="Mã (weekly_ops)"
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                data-testid="csd-report-template-create-code"
              />
              <input
                className="kpi-input"
                required
                placeholder="Tên tiếng Việt"
                value={createForm.name_vi}
                onChange={(e) => setCreateForm({ ...createForm, name_vi: e.target.value })}
              />
              <input
                className="kpi-input"
                placeholder="Mục, cách nhau bằng dấu phẩy"
                value={createForm.sections_text}
                onChange={(e) => setCreateForm({ ...createForm, sections_text: e.target.value })}
              />
              <label className="muted">
                <input
                  type="checkbox"
                  checked={createForm.requires_approval}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, requires_approval: e.target.checked })
                  }
                />{' '}
                Cần duyệt trước khi gửi
              </label>
            </div>
            <button type="submit" className="btn btn-sm" disabled={busy}>
              Tạo mẫu
            </button>
          </form>
        ) : null}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Mục</th>
                <th>Duyệt</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Chưa có mẫu
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const draft = drafts[row.id] ?? {
                    name_vi: row.name_vi,
                    requires_approval: row.requires_approval,
                    sections_text: sectionsToText(row.sections_json ?? []),
                  };
                  return (
                    <tr key={row.id} data-testid={`csd-report-template-${row.code}`}>
                      <td>{row.code}</td>
                      <td>
                        <input
                          className="kpi-input"
                          value={draft.name_vi}
                          onChange={(e) => patchDraft(row.id, { name_vi: e.target.value })}
                          data-testid={`csd-report-template-name-${row.code}`}
                        />
                      </td>
                      <td>
                        <input
                          className="kpi-input"
                          value={draft.sections_text}
                          onChange={(e) => patchDraft(row.id, { sections_text: e.target.value })}
                          data-testid={`csd-report-template-sections-${row.code}`}
                        />
                      </td>
                      <td>
                        <label className="muted">
                          <input
                            type="checkbox"
                            checked={draft.requires_approval}
                            onChange={(e) =>
                              patchDraft(row.id, { requires_approval: e.target.checked })
                            }
                            data-testid={`csd-report-template-approval-${row.code}`}
                          />{' '}
                          Cần duyệt
                        </label>
                      </td>
                      <td>{row.active ? 'Đang dùng' : 'Đã lưu trữ'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={busy}
                          data-testid={`csd-report-template-save-${row.code}`}
                          onClick={() => void saveRow(row)}
                        >
                          Lưu
                        </button>
                        {row.active ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            disabled={busy}
                            data-testid={`csd-report-template-archive-${row.code}`}
                            onClick={() => void archiveRow(row)}
                          >
                            Lưu trữ
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </StaffPageShell>
  );
}
