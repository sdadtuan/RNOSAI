'use client';

import React, { useEffect, useState } from 'react';
import type { ContentOsContext } from '@/lib/content-os-api';
import {
  DEFAULT_DIRECT_SOCIAL_PUBLISH,
  DEFAULT_SSO_ENFORCED,
  SSO_ENFORCED_LABEL,
  ssoEnforcedControl,
} from '@/lib/crm/cmkte-settings';

export const SETTINGS_SAVE_TOAST = 'Đã lưu policy.';
export const SETTINGS_SAVE_ERROR_TOAST = 'Không lưu được policy.';

function flagLabel(value: boolean | undefined): string {
  if (value == null) return '—';
  return value ? 'Bật' : 'Tắt';
}

export function CmktESettings({
  context,
  directSocialPublish = DEFAULT_DIRECT_SOCIAL_PUBLISH,
  ssoEnforced = DEFAULT_SSO_ENFORCED,
  onSavePolicy,
}: {
  context: ContentOsContext | null;
  directSocialPublish?: boolean;
  ssoEnforced?: boolean;
  onSavePolicy?: (next: boolean) => Promise<void>;
}) {
  const [toast, setToast] = useState('');
  const [enabled, setEnabled] = useState(directSocialPublish);
  const [saving, setSaving] = useState(false);
  const approval = context?.flags.approval_required;
  const clientGate = context?.flags.client_gate;

  useEffect(() => {
    setEnabled(directSocialPublish);
  }, [directSocialPublish]);

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
          <button
            type="button"
            className="cmkte-btn cmkte-btn--blue"
            disabled={saving}
            onClick={() => {
              void (async () => {
                if (!onSavePolicy) {
                  setToast(SETTINGS_SAVE_TOAST);
                  return;
                }
                setSaving(true);
                try {
                  await onSavePolicy(enabled);
                  setToast(SETTINGS_SAVE_TOAST);
                } catch {
                  setToast(SETTINGS_SAVE_ERROR_TOAST);
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            Save policy
          </button>
        </div>
      </div>

      <div className="cmkte-card">
        <div className="cmkte-checkrow">
          <label className="cmkte-checkrow__flag">
            <input
              type="checkbox"
              role="switch"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <span>Direct social publish connector (tắt · disabled).</span>
          </label>
        </div>
        <div className="cmkte-checkrow">
          <label className="cmkte-checkrow__flag">
            <input
              type="checkbox"
              name="sso_enforced"
              role="switch"
              {...ssoEnforcedControl(ssoEnforced)}
            />
            <span>{SSO_ENFORCED_LABEL}</span>
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
