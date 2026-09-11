'use client';

import React, { useEffect, useState } from 'react';
import type { ContentOsContext } from '@/lib/content-os-api';
import {
  AUDIT_EXPORT_EMPTY_TOAST,
  AUDIT_EXPORT_ERROR_TOAST,
  AUDIT_RETENTION_COPY,
  DEFAULT_DIRECT_SOCIAL_PUBLISH,
  DEFAULT_SSO_ENFORCED,
  SSO_ENFORCED_LABEL,
  isAuditExportEmpty,
  ssoEnforcedControl,
} from '@/lib/crm/cmkte-settings';
import { facebookOAuthStartUrl, type ChannelAccountPublic } from '@/lib/crm/cmkte-api';
import { facebookPageHealth } from '@/lib/crm/cmkte-win-publish';

export const SETTINGS_SAVE_TOAST = 'Đã lưu policy.';
export const SETTINGS_SAVE_ERROR_TOAST = 'Không lưu được policy.';
export const SETTINGS_EXPORT_OK_TOAST = 'Đã xuất audit.';

function downloadAuditCsv(csv: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'cmkt-audit-export.csv';
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 0);
}

function flagLabel(value: boolean | undefined): string {
  if (value == null) return '—';
  return value ? 'Bật' : 'Tắt';
}

export function CmktESettings({
  context,
  directSocialPublish = DEFAULT_DIRECT_SOCIAL_PUBLISH,
  ssoEnforced = DEFAULT_SSO_ENFORCED,
  accounts = [],
  onSavePolicy,
  onExportAudit,
  onDisconnect,
}: {
  context: ContentOsContext | null;
  directSocialPublish?: boolean;
  ssoEnforced?: boolean;
  accounts?: ChannelAccountPublic[];
  onSavePolicy?: (next: boolean) => Promise<void>;
  onExportAudit?: () => Promise<string>;
  onDisconnect?: (id: number) => Promise<void>;
}) {
  const [toast, setToast] = useState('');
  const [enabled, setEnabled] = useState(directSocialPublish);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const approval = context?.flags.approval_required;
  const clientGate = context?.flags.client_gate;
  const facebookPage = accounts.find((row) => row.channel === 'facebook_page') ?? accounts[0];
  const health = facebookPageHealth(accounts);
  const disconnectId = facebookPage?.connector_id ?? facebookPage?.id;

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
          <button
            type="button"
            className="cmkte-btn"
            disabled={exporting}
            onClick={() => {
              void (async () => {
                if (!onExportAudit) {
                  setToast(AUDIT_EXPORT_ERROR_TOAST);
                  return;
                }
                setExporting(true);
                try {
                  const csv = await onExportAudit();
                  if (isAuditExportEmpty(csv)) {
                    setToast(AUDIT_EXPORT_EMPTY_TOAST);
                    return;
                  }
                  downloadAuditCsv(csv);
                  setToast(SETTINGS_EXPORT_OK_TOAST);
                } catch {
                  setToast(AUDIT_EXPORT_ERROR_TOAST);
                } finally {
                  setExporting(false);
                }
              })();
            }}
          >
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
            <span>
              Direct social publish connector ({enabled ? 'bật · enabled' : 'tắt · disabled'}).
            </span>
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
        <div className="cmkte-checkrow">
          <span>{AUDIT_RETENTION_COPY}</span>
        </div>
        <div className="cmkte-checkrow">
          <div>
            <b>{facebookPage?.display_name || 'Facebook Page'}</b>
            <p className="cmkte-desc">OAuth server-side, token không ra browser.</p>
          </div>
          <span className="cmkte-tag">{health}</span>
        </div>
        <div className="cmkte-actions">
          <button
            type="button"
            className="cmkte-btn cmkte-btn--blue"
            onClick={() => {
              window.location.assign(facebookOAuthStartUrl());
            }}
          >
            Connect Page
          </button>
          <button
            type="button"
            className="cmkte-btn"
            disabled={disconnectId == null || !onDisconnect}
            onClick={() => {
              if (disconnectId == null || !onDisconnect) return;
              void onDisconnect(disconnectId);
            }}
          >
            Disconnect
          </button>
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
