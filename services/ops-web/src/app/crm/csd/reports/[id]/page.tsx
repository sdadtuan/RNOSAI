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
  rollupCsdReportTickets,
  retryCsdReportSend,
  sendCsdReport,
  snapshotCsdReportVersion,
  submitCsdReportReview,
  transitionCsdReport,
  updateCsdReportSections,
  uploadCsdReportFile,
  exportCsdReportPdf,
  exportCsdReportXlsx,
  type CsdReportDetail,
  type CsdReportStatus,
} from '@/lib/crm/csd-api';

export default function CsdReportDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, token, error, setError, logout, canWrite, canManage } = useCsdPageAuth('view');
  const [report, setReport] = useState<CsdReportDetail | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ to: '', subject: '', body: '', schedule_at: '', attach_pdf: true });
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

  async function handleSend(schedule: boolean) {
    if (!token || !report) return;
    if (schedule && !sendForm.schedule_at.trim()) {
      setError('Chọn thời điểm lên lịch');
      return;
    }
    setBusy(true);
    try {
      await sendCsdReport(token, report.id, {
        to: sendForm.to.split(',').map((s) => s.trim()).filter(Boolean),
        subject: sendForm.subject,
        body: sendForm.body,
        ...(schedule && sendForm.schedule_at.trim()
          ? { schedule_at: new Date(sendForm.schedule_at).toISOString() }
          : {}),
      });
      setSendOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi báo cáo thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleRetrySend() {
    if (!token || !report) return;
    setBusy(true);
    try {
      await retryCsdReportSend(token, report.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi lại thất bại');
    } finally {
      setBusy(false);
    }
  }

  const lastSendFailed =
    report != null &&
    report.status !== 'sent' &&
    (report.send_logs?.[0]?.result === 'failed');

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
      {lastSendFailed ? (
        <div className="page-card csd-report-send-failed" role="alert">
          <p className="error">Gửi báo cáo thất bại.</p>
          {canWrite ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              data-testid="csd-report-retry-send"
              onClick={() => void handleRetrySend()}
            >
              Gửi lại
            </button>
          ) : null}
        </div>
      ) : null}
      {report ? (
        <CsdReportEditor
          report={report}
          canWrite={canWrite}
          canManage={canManage}
          onSaveSection={async (key, section) => {
            await updateCsdReportSections(token, report.id, {
              ...report.sections_json,
              [key]: section,
            });
            await reload();
          }}
          onRollup={async () => {
            await rollupCsdReportTickets(token, report.id);
            await reload();
          }}
          onUploadFile={async (file) => uploadCsdReportFile(token, report.id, file)}
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
          onExportPdf={async () => {
            await exportCsdReportPdf(token, report.id);
          }}
          onExportXlsx={async () => {
            await exportCsdReportXlsx(token, report.id);
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
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend(false);
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="kpi-section-title">Gửi báo cáo PDF</h3>
            <label className="stack-gap">
              Đến *
              <input
                className="kpi-input"
                placeholder="email@khach.vn"
                required
                value={sendForm.to}
                onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
              />
            </label>
            <label className="stack-gap">
              Subject
              <input
                className="kpi-input"
                placeholder="Tiêu đề"
                required
                value={sendForm.subject}
                onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })}
              />
            </label>
            <label className="stack-gap">
              Body
              <textarea
                className="kpi-input"
                rows={4}
                placeholder="Lời nhắn"
                value={sendForm.body}
                onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
              />
            </label>
            <label className="csd-report-send-pdf">
              <input
                type="checkbox"
                checked={sendForm.attach_pdf}
                onChange={(e) => setSendForm({ ...sendForm, attach_pdf: e.target.checked })}
              />
              Đính kèm PDF
            </label>
            <label className="stack-gap">
              Lên lịch
              <input
                className="kpi-input"
                type="datetime-local"
                value={sendForm.schedule_at}
                onChange={(e) => setSendForm({ ...sendForm, schedule_at: e.target.value })}
              />
            </label>
            <div className="csd-composer__actions">
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSendOpen(false)}>
                Huỷ
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                onClick={() => void handleSend(true)}
              >
                Lên lịch
              </button>
              <button type="submit" className="btn btn-sm" disabled={busy}>
                Gửi ngay
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </StaffPageShell>
  );
}
