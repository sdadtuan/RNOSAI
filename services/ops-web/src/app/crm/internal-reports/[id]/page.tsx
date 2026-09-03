'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { IwrReportEditor } from '@/components/crm/iwr/IwrReportEditor';
import { useIwrPageAuth } from '@/components/crm/iwr/useIwrPageAuth';
import {
  ackIwrReport,
  addIwrComment,
  fetchIwrComments,
  fetchIwrReport,
  markIwrViewed,
  patchIwrReport,
  requestIwrChanges,
  submitIwrReport,
  withdrawIwrReport,
  type IwrCommentRow,
  type IwrReportDetail,
} from '@/lib/crm/iwr-api';

export default function IwrReportDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, token, error, setError, logout, canWrite, canReview } = useIwrPageAuth('view');
  const [report, setReport] = useState<IwrReportDetail | null>(null);
  const [comments, setComments] = useState<IwrCommentRow[]>([]);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const [detail, commentOut] = await Promise.all([
        fetchIwrReport(token, params.id),
        fetchIwrComments(token, params.id),
      ]);
      setReport(detail);
      setComments(commentOut.items ?? []);
      void markIwrViewed(token, params.id)
        .then((out) => {
          setReport((prev) => (prev ? { ...prev, first_viewed_at: out.first_viewed_at } : prev));
        })
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải báo cáo thất bại');
    }
  }, [token, params.id, setError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <StaffPageShell user={user ?? null} onLogout={logout} loading={!user && !report}>
      <PageToolbar
        title={report?.title ?? 'Báo cáo nội bộ'}
        subtitle={report?.template_name_vi}
        actions={
          <Link href="/crm/internal-reports" className="text-sm text-blue-600 hover:underline">
            ← Danh sách
          </Link>
        }
      />
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {report && token && (
        <IwrReportEditor
          token={token}
          report={report}
          canWrite={canWrite}
          canReview={canReview}
          comments={comments}
          onPatch={async (body) => {
            const updated = await patchIwrReport(token, report.id, body);
            setReport(updated);
          }}
          onSubmit={async (body) => {
            const updated = await submitIwrReport(token, report.id, body);
            setReport(updated);
            await reload();
          }}
          onWithdraw={async () => {
            const updated = await withdrawIwrReport(token, report.id);
            setReport(updated);
          }}
          onAck={async () => {
            const updated = await ackIwrReport(token, report.id);
            setReport(updated);
            await reload();
          }}
          onRequestChanges={async (body) => {
            const updated = await requestIwrChanges(token, report.id, body);
            setReport(updated);
            await reload();
          }}
          onAddComment={async (body) => {
            await addIwrComment(token, report.id, body);
            await reload();
          }}
        />
      )}
    </StaffPageShell>
  );
}
