'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { CsdReportEditor } from '@/components/crm/csd/CsdReportEditor';
import { useCsdPageAuth } from '@/components/crm/csd/useCsdPageAuth';
import {
  approveCsdReport,
  getCsdReport,
  requestCsdReportChanges,
  reviseCsdReport,
  sendCsdReport,
  snapshotCsdReportVersion,
  submitCsdReportReview,
  transitionCsdReport,
  updateCsdReportSections,
  type CsdReportDetail,
  type CsdReportStatus,
} from '@/lib/crm/csd-api';

export default function CsdReportDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, token, error, setError, logout, canWrite, canManage } = useCsdPageAuth('view');
  const [report, setReport] = useState<CsdReportDetail | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ to: '', subject: '', body: '' });
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const out = await getCsdReport(token, params.id);
      setReport(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải báo cáo thất bại');
    }
  }, [token, params.id, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !report) return;
    setBusy(true);
    try {
      await sendCsdReport(token, report.id, {
        to: sendForm.to.split(',').map((s) => s.trim()).filter(Boolean),
        subject: sendForm.subject,
        body: sendForm.body,
      });
      setSendOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi báo cáo thất bại');
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
        { label: report?.title ?? params.id },
      ]}
      width="full"
    >
      <PageToolbar
        title={report?.title ?? report?.template_name_vi ?? 'Biên tập báo cáo'}
        subtitle="Mục theo mẫu · duyệt theo trạng thái · gửi PDF"
      />
      {error ? (
        <div className="page-card">
          <p className="error">{error}</p>
        </div>
      ) : null}
      {report ? (
        <CsdReportEditor
          report={report}
          canWrite={canWrite}
          canManage={canManage}
          onSaveSection={async (key, value) => {
            await updateCsdReportSections(token, report.id, {
              ...report.sections_json,
              [key]: { body: value },
            });
            await reload();
          }}
          onSubmitReview={async () => {
            await submitCsdReportReview(token, report.id);
            await reload();
          }}
          onApprove={async () => {
            await approveCsdReport(token, report.id);
            await reload();
          }}
          onRequestChanges={async (comment) => {
            await requestCsdReportChanges(token, report.id, comment);
            await reload();
          }}
          onTransition={async (to: CsdReportStatus) => {
            if (to === 'sent') return;
            await transitionCsdReport(token, report.id, { to });
            await reload();
          }}
          onSend={() => setSendOpen(true)}
          onSnapshot={async ({ kind, changelog }) => {
            await snapshotCsdReportVersion(token, report.id, { kind, changelog });
            await reload();
          }}
          onRevise={async () => {
            await reviseCsdReport(token, report.id);
            await reload();
          }}
        />
      ) : (
        <div className="page-card">
          <p className="muted">Đang tải…</p>
        </div>
      )}

      {sendOpen && report ? (
        <div className="csd-modal-backdrop" role="presentation" onClick={() => setSendOpen(false)}>
          <form
            className="csd-modal page-card stack-gap"
            onSubmit={(e) => void handleSend(e)}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="kpi-section-title">Gửi báo cáo PDF</h3>
            <input
              className="kpi-input"
              placeholder="Đến"
              required
              value={sendForm.to}
              onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
            />
            <input
              className="kpi-input"
              placeholder="Tiêu đề"
              required
              value={sendForm.subject}
              onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })}
            />
            <textarea
              className="kpi-input"
              rows={4}
              placeholder="Lời nhắn"
              value={sendForm.body}
              onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
            />
            <div className="csd-composer__actions">
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSendOpen(false)}>
                Huỷ
              </button>
              <button type="submit" className="btn btn-sm" disabled={busy}>
                Gửi
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </StaffPageShell>
  );
}
