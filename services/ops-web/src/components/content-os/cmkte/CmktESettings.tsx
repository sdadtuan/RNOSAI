'use client';

import { useState } from 'react';
import type { ContentOsContext } from '@/lib/content-os-api';

export const SETTINGS_SAVE_TOAST = 'E0 chỉ hiển thị — không lưu policy.';

function flagLabel(value: boolean | undefined): string {
  if (value == null) return '—';
  return value ? 'Bật' : 'Tắt';
}

export function CmktESettings({ context }: { context: ContentOsContext | null }) {
  const [toast, setToast] = useState('');
  const approval = context?.flags.approval_required;
  const clientGate = context?.flags.client_gate;

  return (
    <div className="cmkte-reqpage">
      <div className="cmkte-head">
        <div>
          <h1>Governance Settings</h1>
          <p>Flag, cap, approval template và publish gate — admin only.</p>
        </div>
        <div className="cmkte-actions">
          <button type="button" className="cmkte-btn" disabled>
            Audit export
          </button>
          <button type="button" className="cmkte-btn cmkte-btn--blue" onClick={() => setToast(SETTINGS_SAVE_TOAST)}>
            Save policy
          </button>
        </div>
      </div>

      <div className="cmkte-card">
        <div className="cmkte-checkrow">
          <label className="cmkte-checkrow__flag">
            <input type="checkbox" role="switch" disabled checked={false} />
            <span>Direct social publish connector (tắt · disabled).</span>
          </label>
        </div>
        <div className="cmkte-checkrow">
          <span>Approval required</span>
          <b>{flagLabel(approval)}</b>
        </div>
        <div className="cmkte-checkrow">
          <span>Client gate</span>
          <b>{flagLabel(clientGate)}</b>
        </div>
        {!context ? <p className="cmkte-empty">Chưa chọn lifecycle — flags hiển thị —.</p> : null}
      </div>

      {toast ? (
        <div className="cmkte-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
