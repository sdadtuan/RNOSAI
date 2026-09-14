'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { SegmentedControl } from '@/components/layout';
import {
  fetchCrmLeadLookups,
  fetchLeadClassificationConfig,
  saveLeadClassificationConfig,
  staffMe,
  staffRefresh,
  type LeadClassificationConfig,
  type LeadFlowKindConfig,
  type LeadLevelTierConfig,
  type LeadRoutingRuleConfig,
} from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { leadFlowKindLabel } from '@/lib/crm/lead-flow-kind';

const FLOW_TABS: { id: LeadFlowKindConfig; label: string }[] = [
  { id: 'b2b_prospect', label: 'B2B Sales' },
  { id: 'spa_operational', label: 'CSKH vận hành' },
];

function newRuleId(): string {
  return `rule_${Date.now().toString(36)}`;
}

export default function AdminLeadClassificationPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [flowTab, setFlowTab] = useState<LeadFlowKindConfig>('b2b_prospect');
  const [config, setConfig] = useState<LeadClassificationConfig | null>(null);
  const [channelOptions, setChannelOptions] = useState<string[]>([]);
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [ruleDraft, setRuleDraft] = useState({
    label: '',
    channel: '*',
    source: '*',
    requires_client: 'any' as 'any' | 'yes' | 'no',
    priority: 50,
  });

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_data_config', 'view')) {
        setError('Không có quyền CRM data config');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  const reload = useCallback(async (access: string) => {
    const [cfg, lookups] = await Promise.all([
      fetchLeadClassificationConfig(access),
      fetchCrmLeadLookups(access, { active_only: true }),
    ]);
    setConfig(cfg);
    setChannelOptions(
      lookups.options.filter((o) => o.kind === 'channel').map((o) => o.option_key),
    );
    setSourceOptions(
      lookups.options.filter((o) => o.kind === 'source').map((o) => o.option_key),
    );
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        await reload(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải cấu hình thất bại');
      }
    })();
  }, [ensureAuth, reload]);

  const flowProfile = config?.flows[flowTab];
  const flowRules = useMemo(
    () => (config?.routing_rules ?? []).filter((rule) => rule.flow_kind === flowTab),
    [config?.routing_rules, flowTab],
  );

  function patchTier(tierId: string, patch: Partial<LeadLevelTierConfig>) {
    if (!config) return;
    setConfig({
      ...config,
      flows: {
        ...config.flows,
        [flowTab]: {
          ...config.flows[flowTab],
          level_tiers: config.flows[flowTab].level_tiers.map((tier) =>
            tier.id === tierId ? { ...tier, ...patch } : tier,
          ),
        },
      },
    });
  }

  function addRoutingRule() {
    if (!config) return;
    const requires_client =
      ruleDraft.requires_client === 'yes'
        ? true
        : ruleDraft.requires_client === 'no'
          ? false
          : null;
    const next: LeadRoutingRuleConfig = {
      id: newRuleId(),
      label: ruleDraft.label.trim() || `${ruleDraft.channel}/${ruleDraft.source}`,
      channel: ruleDraft.channel.trim() || '*',
      source: ruleDraft.source.trim() || '*',
      requires_client,
      flow_kind: flowTab,
      priority: Number(ruleDraft.priority) || 50,
      enabled: true,
    };
    setConfig({ ...config, routing_rules: [...config.routing_rules, next] });
    setRuleDraft({ label: '', channel: '*', source: '*', requires_client: 'any', priority: 50 });
  }

  function updateRule(ruleId: string, patch: Partial<LeadRoutingRuleConfig>) {
    if (!config) return;
    setConfig({
      ...config,
      routing_rules: config.routing_rules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule,
      ),
    });
  }

  function removeRule(ruleId: string) {
    if (!config) return;
    setConfig({
      ...config,
      routing_rules: config.routing_rules.filter((rule) => rule.id !== ruleId),
    });
  }

  async function handleSave() {
    const access = getAccessToken();
    if (!access || !config || !canConfigure) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const saved = await saveLeadClassificationConfig(access, config);
      setConfig(saved);
      setMsg('Đã lưu cấu hình phân loại lead');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <AdminPageShell
        user={null}
        onLogout={logout}
        section="crm-config"
        title="Phân loại Lead"
        subtitle="Ngưỡng điểm và quy tắc kênh/nguồn"
        loading
      >
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Phân loại Lead"
      subtitle="Cấu hình phân hạng và quy tắc gán loại lead (B2B Sales / CSKH vận hành) theo kênh & nguồn"
    >
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}

        <SegmentedControl
          label="Loại lead"
          options={FLOW_TABS}
          value={flowTab}
          onChange={(id) => setFlowTab(id as LeadFlowKindConfig)}
        />

        {config ? (
          <>
            <section className="stack-gap">
              <h3 className="kpi-section-title">Ngưỡng phân hạng — {leadFlowKindLabel(flowTab)}</h3>
              <p className="muted">
                Điểm lead (0–100) được map vào hạng Nóng/Ấm/Lạnh. Lead mới từ quảng cáo mặc định{' '}
                <strong>{flowProfile?.default_inbound_score ?? 75}</strong> điểm nếu chưa có AI score.
              </p>
              <label className="admin-crm-form__grid">
                <span>Điểm mặc định lead mới (kênh ads)</span>
                <input
                  className="kpi-input"
                  type="number"
                  min={0}
                  max={100}
                  disabled={!canConfigure}
                  value={flowProfile?.default_inbound_score ?? 75}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      flows: {
                        ...config.flows,
                        [flowTab]: {
                          ...config.flows[flowTab],
                          default_inbound_score: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </label>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Hạng</th>
                      <th>Điểm min</th>
                      <th>Điểm max</th>
                      <th>SLA</th>
                      <th>Bật</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(flowProfile?.level_tiers ?? []).map((tier) => (
                      <tr key={tier.id}>
                        <td>
                          {tier.emoji} {tier.label}
                          <div className="muted">{tier.description}</div>
                        </td>
                        <td>
                          <input
                            className="kpi-input"
                            type="number"
                            min={0}
                            max={100}
                            disabled={!canConfigure}
                            value={tier.min_score}
                            onChange={(e) => patchTier(tier.id, { min_score: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            className="kpi-input"
                            type="number"
                            min={0}
                            max={100}
                            disabled={!canConfigure}
                            value={tier.max_score}
                            onChange={(e) => patchTier(tier.id, { max_score: Number(e.target.value) })}
                          />
                        </td>
                        <td>{tier.sla_label}</td>
                        <td>
                          <input
                            type="checkbox"
                            disabled={!canConfigure}
                            checked={tier.enabled}
                            onChange={(e) => patchTier(tier.id, { enabled: e.target.checked })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="stack-gap">
              <h3 className="kpi-section-title">
                Quy tắc kênh & nguồn → {leadFlowKindLabel(flowTab)}
              </h3>
              <p className="muted">
                Mọi lead từ kênh/nguồn đều có thể map vào loại lead. Quy tắc có priority cao hơn được
                áp dụng trước. Dùng <code>*</code> cho &quot;tất cả&quot;.
              </p>

              {canConfigure ? (
                <div className="admin-crm-form stack-gap">
                  <div className="admin-crm-form__grid">
                    <input
                      className="kpi-input"
                      placeholder="Nhãn quy tắc"
                      value={ruleDraft.label}
                      onChange={(e) => setRuleDraft({ ...ruleDraft, label: e.target.value })}
                    />
                    <select
                      className="kpi-select"
                      value={ruleDraft.channel}
                      onChange={(e) => setRuleDraft({ ...ruleDraft, channel: e.target.value })}
                    >
                      <option value="*">Kênh: * (tất cả)</option>
                      {channelOptions.map((key) => (
                        <option key={key} value={key}>
                          Kênh: {key}
                        </option>
                      ))}
                    </select>
                    <select
                      className="kpi-select"
                      value={ruleDraft.source}
                      onChange={(e) => setRuleDraft({ ...ruleDraft, source: e.target.value })}
                    >
                      <option value="*">Nguồn: * (tất cả)</option>
                      {sourceOptions.map((key) => (
                        <option key={key} value={key}>
                          Nguồn: {key}
                        </option>
                      ))}
                    </select>
                    <select
                      className="kpi-select"
                      value={ruleDraft.requires_client}
                      onChange={(e) =>
                        setRuleDraft({
                          ...ruleDraft,
                          requires_client: e.target.value as 'any' | 'yes' | 'no',
                        })
                      }
                    >
                      <option value="any">Client: bất kỳ</option>
                      <option value="yes">Phải gắn client</option>
                      <option value="no">Không gắn client</option>
                    </select>
                    <input
                      className="kpi-input"
                      type="number"
                      placeholder="Priority"
                      value={ruleDraft.priority}
                      onChange={(e) => setRuleDraft({ ...ruleDraft, priority: Number(e.target.value) })}
                    />
                  </div>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={addRoutingRule}>
                    + Thêm quy tắc
                  </button>
                </div>
              ) : null}

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nhãn</th>
                      <th>Kênh</th>
                      <th>Nguồn</th>
                      <th>Client</th>
                      <th>Priority</th>
                      <th>Bật</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {flowRules.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="muted">
                          Chưa có quy tắc cho tab này.
                        </td>
                      </tr>
                    ) : (
                      flowRules.map((rule) => (
                        <tr key={rule.id}>
                          <td>{rule.label || rule.id}</td>
                          <td>{rule.channel}</td>
                          <td>{rule.source}</td>
                          <td>
                            {rule.requires_client === true
                              ? 'Có client'
                              : rule.requires_client === false
                                ? 'Không client'
                                : '—'}
                          </td>
                          <td>
                            <input
                              className="kpi-input"
                              type="number"
                              disabled={!canConfigure}
                              value={rule.priority}
                              onChange={(e) =>
                                updateRule(rule.id, { priority: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              disabled={!canConfigure}
                              checked={rule.enabled}
                              onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                            />
                          </td>
                          <td>
                            {canConfigure ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-ghost"
                                onClick={() => removeRule(rule.id)}
                              >
                                Xóa
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="stack-gap">
              <h3 className="kpi-section-title">Fallback</h3>
              <p className="muted">Khi không khớp quy tắc nào, lead được gán loại mặc định:</p>
              <select
                className="kpi-select"
                disabled={!canConfigure}
                value={config.default_flow_kind}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    default_flow_kind: e.target.value as LeadFlowKindConfig,
                  })
                }
              >
                <option value="b2b_prospect">B2B Sales</option>
                <option value="spa_operational">CSKH vận hành</option>
              </select>
            </section>

            {canConfigure ? (
              <button type="button" className="btn" disabled={busy} onClick={() => void handleSave()}>
                {busy ? 'Đang lưu…' : 'Lưu cấu hình'}
              </button>
            ) : (
              <p className="muted">Chế độ chỉ xem — cần quyền configure để lưu.</p>
            )}
          </>
        ) : (
          <p className="muted">Đang tải…</p>
        )}
      </div>
    </AdminPageShell>
  );
}
