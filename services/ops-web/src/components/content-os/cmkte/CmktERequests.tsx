'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/auth';
import {
  convertPortfolioRequest,
  mapIntakeRows,
  type LifecycleIdeaRow,
  type PortfolioContentRequest,
} from '@/lib/crm/cmkte-api';
import type { ContentRequestCreated } from '@/lib/crm/cmkte-request-form';
import { cmktePath } from '@/lib/crm/cmkte-routes';
import { CmktERequestModal } from './CmktERequestModal';

function dash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
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
  const [brandId, setBrandId] = useState('');
  const [locale, setLocale] = useState('');

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const rows = useMemo(() => mapIntakeRows(localItems, ideas), [localItems, ideas]);

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
    const brand_id = brandId.trim();
    const localeValue = locale.trim();
    if (!brand_id || !localeValue) {
      showToast('Thiếu brand_id và locale — không convert.');
      return;
    }
    setConvertingId(requestId);
    try {
      const out = await convertPortfolioRequest(token, requestId, { brand_id, locale: localeValue });
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
        <div className="cmkte-grid2">
          <label className="cmkte-field">
            <span>
              Brand ID <span className="cmkte-req">*</span>
            </span>
            <input
              className="cmkte-input"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="cmkte-field">
            <span>
              Locale <span className="cmkte-req">*</span>
            </span>
            <input
              className="cmkte-input"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              autoComplete="off"
              placeholder="vi-VN"
            />
          </label>
        </div>
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
