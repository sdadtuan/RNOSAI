'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/auth';
import {
  parseCmktGateError,
  postContentOsApproveItem,
  postContentOsRejectItem,
} from '@/lib/content-os-api';
import {
  APPROVALS_EMPTY,
  ESCALATE_TOAST,
  OPEN_PORTAL_TOAST,
  approvalReviewHref,
  canBatchApprove,
} from '@/lib/crm/cmkte-approvals';
import { postPortfolioApprovalsBatch, type PortfolioApprovalItem } from '@/lib/crm/cmkte-api';
import { rejectCommentValid } from '@/lib/crm/cmkte-workspace';

function dash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function CmktEApprovals({ items }: { items: PortfolioApprovalItem[] }) {
  const router = useRouter();
  const [toast, setToast] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);

  const slaBreach = items.filter((row) => row.sla_breach).length;
  const clientWaiting = items.filter((row) => row.status === 'pending_client').length;

  function showToast(message: string) {
    setToast(message);
  }

  async function runLifecycleAction(
    row: PortfolioApprovalItem,
    fn: (token: string) => Promise<unknown>,
  ) {
    const token = getAccessToken();
    if (!token) {
      showToast('Thiếu phiên đăng nhập.');
      return;
    }
    if (!(row.lifecycle_id > 0 && row.id > 0)) {
      showToast('Thiếu lifecycle hoặc item — không gọi API.');
      return;
    }
    setBusyId(row.id);
    try {
      await fn(token);
      showToast('Đã cập nhật hàng đợi duyệt.');
    } catch (err) {
      showToast(parseCmktGateError(err));
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelected(id: number, checked: boolean) {
    setSelected((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((itemId) => itemId !== id);
    });
  }

  async function onBatchApprove() {
    if (!canBatchApprove(selected)) return;
    const token = getAccessToken();
    if (!token) {
      showToast('Thiếu phiên đăng nhập.');
      return;
    }
    setBatchBusy(true);
    try {
      const out = await postPortfolioApprovalsBatch(token, selected);
      const failedN = out.failed.length;
      showToast(
        failedN
          ? `Đã duyệt ${out.ok.length}, lỗi ${failedN}.`
          : `Đã duyệt hàng loạt ${out.ok.length} item.`,
      );
      setSelected((prev) => prev.filter((id) => !out.ok.includes(id)));
    } catch (err) {
      showToast(parseCmktGateError(err));
    } finally {
      setBatchBusy(false);
    }
  }

  function onReject(row: PortfolioApprovalItem) {
    if (!rejectCommentValid(rejectComment)) {
      showToast('Comment từ chối tối thiểu 10 ký tự.');
      return;
    }
    void runLifecycleAction(row, (token) =>
      postContentOsRejectItem(token, row.lifecycle_id, row.id, rejectComment.trim()),
    );
  }

  return (
    <div className="cmkte-reqpage">
      <div className="cmkte-head">
        <div>
          <h1>Approval Center</h1>
          <p>Hàng đợi phê duyệt tập trung theo role, risk, SLA và scope để giảm bottleneck toàn agency.</p>
        </div>
        <div className="cmkte-actions">
          <button
            type="button"
            className="cmkte-btn"
            disabled={batchBusy || !canBatchApprove(selected)}
            onClick={() => void onBatchApprove()}
          >
            Duyệt hàng loạt
          </button>
        </div>
      </div>

      <div className="cmkte-grid3">
        <div className="cmkte-card">
          <small className="cmkte-desc">MY ACTIONS TODAY</small>
          <b className="cmkte-metric">{items.length}</b>
        </div>
        <div className="cmkte-card">
          <small className="cmkte-desc">CLIENT WAITING</small>
          <b className="cmkte-metric">{clientWaiting}</b>
        </div>
        <div className="cmkte-card">
          <small className="cmkte-desc">SLA BREACHED</small>
          <b className="cmkte-metric">{slaBreach}</b>
        </div>
      </div>

      <div className="cmkte-card">
        <label className="cmkte-field">
          <span>Reject comment (tối thiểu 10 ký tự)</span>
          <textarea
            className="cmkte-input"
            rows={3}
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
          />
        </label>
        <div className="cmkte-table-scroll">
          <table className="cmkte-table">
            <thead>
              <tr>
                <th />
                <th>Content item</th>
                <th>Status</th>
                <th>Channel</th>
                <th>SLA</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <p className="cmkte-empty">{APPROVALS_EMPTY}</p>
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Chọn item ${row.id}`}
                        checked={selected.includes(row.id)}
                        onChange={(e) => toggleSelected(row.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <span className="cmkte-taskname">
                        {dash(row.title)} · {row.id}
                      </span>
                      <span className="cmkte-dep">
                        {dash(row.format)} · lifecycle {row.lifecycle_id}
                      </span>
                    </td>
                    <td>{dash(row.status)}</td>
                    <td>{dash(row.channel)}</td>
                    <td>
                      {row.sla_breach ? (
                        <span className="cmkte-tag cmkte-tag--red">SLA breach</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className="cmkte-actions">
                        <button
                          type="button"
                          className="cmkte-btn cmkte-btn--small"
                          onClick={() => router.push(approvalReviewHref(row.id))}
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          className="cmkte-btn cmkte-btn--small"
                          disabled={busyId === row.id}
                          onClick={() =>
                            void runLifecycleAction(row, (token) =>
                              postContentOsApproveItem(token, row.lifecycle_id, row.id),
                            )
                          }
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="cmkte-btn cmkte-btn--small"
                          disabled={busyId === row.id}
                          onClick={() => onReject(row)}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="cmkte-btn cmkte-btn--small"
                          onClick={() => showToast(ESCALATE_TOAST)}
                        >
                          Escalate
                        </button>
                        <button
                          type="button"
                          className="cmkte-btn cmkte-btn--small"
                          onClick={() => showToast(OPEN_PORTAL_TOAST)}
                        >
                          Open portal
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast ? (
        <div className="cmkte-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
