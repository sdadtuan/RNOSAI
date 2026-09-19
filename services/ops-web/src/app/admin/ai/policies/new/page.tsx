'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { createAdminAiPolicy } from '@/lib/api';
import { hasCap } from '@/lib/auth';
import { canViewPolicyAdmin, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

const PII_FIELDS = ['phone', 'email', 'national_id', 'address'];

/** SRS PO-52/P4/P5 allowlist — Ops Module. */
const OPS_TOOL_ALLOWLIST = [
  'marketing_plan.read',
  'service_delivery.read',
  'service_delivery.propose_transition',
  'delivery_project.read',
  'kpi_campaign.read',
  'marketing_plan.write_draft',
  'task.create_draft',
  'plan.breakdown_to_roles',
];

const DENIED_HINT = ['email.send', 'proposal.send', 'stage.transition'];

function canViewAiPolicies(user: Parameters<typeof canViewPolicyAdmin>[0]): boolean {
  if (!user) return false;
  return hasCap(user, 'ai_admin', 'view') || canViewPolicyAdmin(user);
}

export default function AdminAiPolicyNewPage() {
  const router = useRouter();
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewAiPolicies);
  const canConfigure = hasCap(user, 'ai_admin', 'configure') || hasCap(user, 'crm_data_config', 'configure');
  const [agentCode, setAgentCode] = useState('ptt-ops-strategist');
  const [allowedTools, setAllowedTools] = useState<string[]>([...OPS_TOOL_ALLOWLIST]);
  const [spendCap, setSpendCap] = useState<number | ''>(50);
  const [piiBlock, setPiiBlock] = useState<string[]>([...PII_FIELDS]);
  const [requireApproval, setRequireApproval] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  function toggleTool(tool: string) {
    setAllowedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool],
    );
  }

  function togglePii(field: string) {
    setPiiBlock((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  }

  function applyOpsPreset() {
    setAgentCode('ptt-ops-strategist');
    setAllowedTools([...OPS_TOOL_ALLOWLIST]);
    setSpendCap(50);
    setPiiBlock([...PII_FIELDS]);
    setRequireApproval(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !canConfigure) return;
    const code = agentCode.trim().toLowerCase().replace(/\s+/g, '-');
    if (!code) {
      setFormError('agent_code bắt buộc');
      return;
    }
    if (allowedTools.length === 0) {
      setFormError('Chọn ít nhất 1 tool trong allowlist');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await createAdminAiPolicy(token, code, {
        allowed_tools: allowedTools,
        spend_cap_usd_monthly: spendCap === '' ? null : Number(spendCap),
        pii_block_fields: piiBlock,
        require_human_approval: requireApproval,
      });
      router.push('/admin/ai/policies');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Tạo policy thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Tạo AI agent policy"
      subtitle="Allowlist PO-52 · spend cap · PII · human approval"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'AI', href: '/admin/ai/agents' },
        { label: 'Policies', href: '/admin/ai/policies' },
        { label: 'Tạo mới' },
      ]}
      loading={loading}
    >
      <div className="admin-governance-page" style={{ maxWidth: 720 }}>
        {error ? <p className="form-error">{error}</p> : null}
        {formError ? <p className="form-error">{formError}</p> : null}

        {!canConfigure ? (
          <p className="muted">Cần quyền ai_admin.configure để tạo policy.</p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="form-grid form-grid--1">
            <div className="form-actions" style={{ marginBottom: '0.75rem' }}>
              <button type="button" className="btn btn-sm" onClick={applyOpsPreset} disabled={busy}>
                Preset Ops Strategist (PO-52)
              </button>
            </div>

            <label className="form-field">
              <span className="form-label">Agent code</span>
              <input
                className="kpi-input"
                value={agentCode}
                onChange={(e) => setAgentCode(e.target.value)}
                placeholder="ptt-ops-strategist"
                required
                disabled={busy}
              />
            </label>

            <fieldset className="form-field">
              <legend className="form-label">Tools cho phép (PO-52)</legend>
              <div className="win-filter-chips">
                {OPS_TOOL_ALLOWLIST.map((tool) => (
                  <button
                    key={tool}
                    type="button"
                    className={`win-filter-chip${allowedTools.includes(tool) ? ' win-filter-chip--active' : ''}`}
                    disabled={busy}
                    onClick={() => toggleTool(tool)}
                  >
                    {tool}
                  </button>
                ))}
              </div>
              <p className="form-hint muted" style={{ marginTop: '0.5rem' }}>
                Cấm mặc định (không đăng ký): {DENIED_HINT.join(', ')}
              </p>
            </fieldset>

            <label className="form-field">
              <span className="form-label">Spend cap (USD / tháng)</span>
              <input
                type="number"
                min={0}
                className="kpi-input"
                value={spendCap}
                disabled={busy}
                onChange={(e) =>
                  setSpendCap(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
            </label>

            <fieldset className="form-field">
              <legend className="form-label">Chặn PII</legend>
              <div className="win-filter-chips">
                {PII_FIELDS.map((field) => (
                  <button
                    key={field}
                    type="button"
                    className={`win-filter-chip${piiBlock.includes(field) ? ' win-filter-chip--active' : ''}`}
                    disabled={busy}
                    onClick={() => togglePii(field)}
                  >
                    {field}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="form-field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={requireApproval}
                disabled={busy}
                onChange={(e) => setRequireApproval(e.target.checked)}
              />
              <span>Require human approval (mọi write draft)</span>
            </label>

            <div className="form-actions" style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Đang tạo…' : 'Tạo policy'}
              </button>
              <Link href="/admin/ai/policies" className="btn">
                Hủy
              </Link>
            </div>
          </form>
        )}
      </div>
    </AdminPageShell>
  );
}
