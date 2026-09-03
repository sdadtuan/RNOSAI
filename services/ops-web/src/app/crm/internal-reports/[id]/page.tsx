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
  fetchIwrAiStatus,
  fetchIwrComments,
  fetchIwrReport,
  markIwrViewed,
  patchIwrReport,
  requestIwrChanges,
  submitIwrReport,
  summarizeIwrReport,
  withdrawIwrReport,
  replyAllIwrReport,
  type IwrCommentRow,
  type IwrReportDetail,
} from '@/lib/crm/iwr-api';

export default function IwrReportDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, token, error, setError, logout, canWrite, canReview, canBcc } = useIwrPageAuth('view');
  const [report, setReport] = useState<IwrReportDetail | null>(null);
  const [comments, setComments] = useState<IwrCommentRow[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const [detail, commentOut, aiStatus] = await Promise.all([
        fetchIwrReport(token, params.id),
        fetchIwrComments(token, params.id),
        fetchIwrAiStatus(token).catch(() => ({ enabled: false })),
      ]);
      setReport(detail);
      setComments(commentOut.items ?? []);
      setAiEnabled(aiStatus.enabled);
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
      {aiEnabled && report && token && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="iwr-ai-summarize"
            className="px-3 py-1.5 rounded bg-violet-700 text-white text-sm"
            onClick={() => {
              void summarizeIwrReport(token, report.id)
                .then((out) => setAiSummary(out.text))
                .catch((err) => setError(err instanceof Error ? err.message : 'AI thất bại'));
            }}
          >
            Tóm tắt AI
          </button>
          {aiSummary && (
            <p className="text-sm text-slate-700 whitespace-pre-wrap border rounded p-3 bg-violet-50 flex-1">
              {aiSummary}
            </p>
          )}
        </div>
      )}
      {report && token && (
        <IwrReportEditor
          token={token}
          report={report}
          canWrite={canWrite}
          canReview={canReview}
          canBcc={canBcc}
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
          onReplyAll={async (body) => {
            await replyAllIwrReport(token, report.id, body);
            await reload();
          }}
        />
      )}
    </StaffPageShell>
  );
}
