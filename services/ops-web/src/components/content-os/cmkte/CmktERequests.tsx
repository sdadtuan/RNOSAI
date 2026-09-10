'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/auth';
import {
  convertPortfolioRequest,
  type LifecycleIdeaRow,
  type PortfolioContentRequest,
} from '@/lib/crm/cmkte-api';
import type { ContentRequestCreated } from '@/lib/crm/cmkte-request-form';
import { cmktePath } from '@/lib/crm/cmkte-routes';
import { CmktERequestModal } from './CmktERequestModal';

type IntakeRow = {
  key: string;
  kind: 'request' | 'idea';
  requestId: number | null;
  code: string;
  deliverable: string;
  context: string;
  completeness: string | null;
  effort: string;
  risk: string;
  source: string;
  triageStatus: string;
  canConvert: boolean;
};

function dash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

function requestRows(items: PortfolioContentRequest[]): IntakeRow[] {
  return items.map((row) => ({
    key: `req-${row.id}`,
    kind: 'request',
    requestId: row.id,
    code: row.display_code || `CR-${row.id}`,
    deliverable: row.deliverable_ask,
    context: [row.client_label, row.brand_label, row.source].filter(Boolean).join(' / ') || '—',
    completeness: Number.isFinite(row.completeness) ? `${row.completeness}% complete` : null,
    effort: [row.effort_h != null ? `${row.effort_h}h` : null, row.tier || row.priority]
      .filter(Boolean)
      .join(' · ') || '—',
    risk: row.risk_level || '—',
    source: row.source,
    triageStatus: row.triage_status,
    canConvert: row.triage_status === 'Accepted',
  }));
}

function ideaRows(ideas: LifecycleIdeaRow[]): IntakeRow[] {
  return ideas
    .filter((idea) => idea.status !== 'converted')
    .map((idea) => ({
      key: `idea-${idea.id}`,
      kind: 'idea',
      requestId: null,
      code: `IDEA-${idea.id}`,
      deliverable: idea.title,
      context: idea.target_goal?.trim() || '—',
      completeness: null,
      effort: '—',
      risk: '—',
      source: 'idea',
      triageStatus: idea.status,
      canConvert: false,
    }));
}

function tagClass(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes('100') || lower.includes('green') || lower === 'normal') return 'cmkte-tag cmkte-tag--green';
  if (lower.includes('legal') || lower.includes('red') || lower.includes('blocked')) {
    return 'cmkte-tag cmkte-tag--red';
  }
  if (lower.includes('amber') || lower.includes('brand') || lower.includes('high') || lower.includes('%')) {
    return 'cmkte-tag cmkte-tag--amber';
  }
  return 'cmkte-tag';
}

export function CmktERequests({
  items,
  ideas = [],
  lifecycleId,
}: {
  items: PortfolioContentRequest[];
  ideas?: LifecycleIdeaRow[];
  lifecycleId?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [badgeExtra, setBadgeExtra] = useState(0);
  const [localItems, setLocalItems] = useState<PortfolioContentRequest[]>(items);
  const [convertingId, setConvertingId] = useState<number | null>(null);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const rows = useMemo(() => [...requestRows(localItems), ...ideaRows(ideas)], [localItems, ideas]);

  function showToast(message: string) {
    setToast(message);
  }

  function onCreated(request: ContentRequestCreated) {
    const created = request as PortfolioContentRequest;
    if (created.id) {
      setLocalItems((prev) => [created, ...prev.filter((row) => row.id !== created.id)]);
    }
    setBadgeExtra((n) => n + 1);
    showToast(
      `${created.display_code || 'Request'} đã tạo · ở lại Intake.`,
    );
  }

  async function onConvert(requestId: number) {
    const token = getAccessToken();
    if (!token) {
      showToast('Thiếu phiên đăng nhập — không convert.');
      return;
    }
    setConvertingId(requestId);
    try {
      const out = await convertPortfolioRequest(token, requestId);
      const itemId = Number(out.item?.id);
      if (!(itemId > 0)) {
        showToast('Convert xong nhưng thiếu item id.');
        return;
      }
      router.push(cmktePath('workspace', itemId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không chuyển được request thành content item.');
    } finally {
      setConvertingId(null);
    }
  }

  return (
    <div className="cmkte-reqpage">
      <div className="cmkte-head">
        <div>
          <h1>
            Content Request Intake
            {badgeExtra > 0 ? <span className="cmkte-badge">{badgeExtra}</span> : null}
          </h1>
          <p>Tiếp nhận, triage và chuẩn hóa yêu cầu nội dung từ Account, Client Portal và campaign plan.</p>
        </div>
        <div className="cmkte-actions">
          <button type="button" className="cmkte-btn" disabled>
            Export queue
          </button>
          <button type="button" className="cmkte-btn cmkte-btn--blue" onClick={() => setOpen(true)}>
            ＋ Tạo request
          </button>
        </div>
      </div>

      <div className="cmkte-card">
        <div className="cmkte-table-scroll">
          <table className="cmkte-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Business context</th>
                <th>Completeness</th>
                <th>Estimated effort</th>
                <th>Risk</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <p className="cmkte-empty">Chưa có content request trong phạm vi lifecycle của bạn.</p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <span className="cmkte-taskname">{row.code}</span>
                      <span className="cmkte-dep">
                        {dash(row.deliverable)} · {row.source} · {dash(row.triageStatus)}
                      </span>
                    </td>
                    <td>{row.context}</td>
                    <td>
                      {row.completeness ? (
                        <span className={tagClass(row.completeness)}>{row.completeness}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{row.effort}</td>
                    <td>
                      {row.risk !== '—' ? <span className={tagClass(row.risk)}>{row.risk}</span> : '—'}
                    </td>
                    <td>
                      {row.canConvert && row.requestId != null ? (
                        <button
                          type="button"
                          className="cmkte-btn cmkte-btn--small"
                          disabled={convertingId === row.requestId}
                          onClick={() => void onConvert(row.requestId as number)}
                        >
                          Triage & create
                        </button>
                      ) : (
                        <span className="cmkte-dep">{row.kind === 'idea' ? 'idea' : dash(row.triageStatus)}</span>
                      )}
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

      <CmktERequestModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={onCreated}
        lifecycleId={lifecycleId}
      />
    </div>
  );
}
