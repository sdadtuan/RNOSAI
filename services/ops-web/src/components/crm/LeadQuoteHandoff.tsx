'use client';

import { useEffect, useState } from 'react';
import {
  createLeadQuoteContract,
  downloadLeadContractDocx,
  fetchLeadImplementationPlan,
  signLeadQuoteContract,
  type LeadFunnelSnapshot,
  type LeadImplementationPlan,
} from '@/lib/api';
import { ActionErrorToast } from '@/components/ui/ActionToast';

function vnd(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

export function LeadQuoteHandoff({
  token,
  leadId,
  contractState,
  contractAmount,
  onFunnelChange,
  onLeadReload,
  onMessage,
  onError,
}: {
  token: string;
  leadId: number;
  contractState: 'none' | 'draft' | 'signed';
  contractAmount: number;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onLeadReload: () => Promise<void>;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<LeadImplementationPlan | null>(null);
  const [planError, setPlanError] = useState('');

  useEffect(() => {
    if (contractState !== 'signed') {
      setPlan(null);
      setPlanError('');
      return undefined;
    }
    let cancelled = false;
    setPlanError('');
    void fetchLeadImplementationPlan(token, leadId)
      .then((next) => {
        if (!cancelled) setPlan(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPlanError(err instanceof Error ? err.message : 'Không tải được kế hoạch triển khai');
      });
    return () => {
      cancelled = true;
    };
  }, [contractState, token, leadId]);

  async function onDownload() {
    setBusy(true);
    try {
      await downloadLeadContractDocx(token, leadId);
      onMessage?.('Đã tải file hợp đồng.');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Không tải được file hợp đồng');
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<{ funnel: LeadFunnelSnapshot }>, done: string) {
    setBusy(true);
    try {
      const out = await action();
      onFunnelChange(out.funnel);
      await onLeadReload();
      onMessage?.(done);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Không thực hiện được');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="quote-handoff">
      <p>Báo giá đã Approve.</p>
      <section aria-label="Hợp đồng">
        <h3>1. Hợp đồng</h3>
        {contractState === 'none' ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              void run(() => createLeadQuoteContract(token, leadId), 'Đã tạo hợp đồng từ báo giá đã Approve.')
            }
          >
            Tạo HĐ
          </button>
        ) : null}
        {contractState === 'draft' || contractState === 'signed' ? (
          <>
            <p>
              {contractState === 'signed' ? 'Hợp đồng đã ký.' : 'Hợp đồng đã tạo.'} Giá trị {vnd(contractAmount)}.
            </p>
            <p>File hợp đồng giữ trên lead này.</p>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void onDownload()}>
              Tải file hợp đồng
            </button>
            {contractState === 'draft' ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void run(() => signLeadQuoteContract(token, leadId), 'Hợp đồng đã ký. Mở kế hoạch triển khai.')}
              >
                Đã ký
              </button>
            ) : null}
          </>
        ) : null}
      </section>
      <section aria-label="Kế hoạch triển khai">
        <h3>2. Kế hoạch triển khai</h3>
        {contractState !== 'signed' ? <p className="muted">Mở sau khi hợp đồng đã ký.</p> : null}
        <ActionErrorToast message={planError} />
        {contractState === 'signed' && plan && plan.groups.length === 0 ? <p>Chưa có hạng mục trong báo giá đã chốt.</p> : null}
        {plan?.groups.map((group) => (
          <div key={`${group.service_name}:${group.phase_name}`}>
            <p>
              <strong>{group.service_name}</strong>
              {group.phase_name ? ` · ${group.phase_name}` : ''}
            </p>
            <table className="rn-table">
              <thead>
                <tr>
                  <th>Việc</th>
                  <th>Việc nhỏ</th>
                  <th>Vai trò</th>
                  <th>Giờ</th>
                </tr>
              </thead>
              <tbody>
                {group.lines.map((line, index) => (
                  <tr key={`${line.task}-${index}`}>
                    <td>{line.task || '—'}</td>
                    <td>{line.subtask || '—'}</td>
                    <td>{line.role_label || '—'}</td>
                    <td>{line.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  );
}
