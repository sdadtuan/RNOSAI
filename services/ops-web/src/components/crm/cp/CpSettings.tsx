'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  CP_MODEL_FIELDS,
  disconnectCpProviderConnection,
  formatCpApiError,
  getCpSettings,
  grantCpCredits,
  listCpProviderConnections,
  patchCpSettings,
  projectCpSettingsForUi,
  saveMagnificRestKey,
  startMagnificOAuth,
  type CpModelSetting,
  type CpProviderConnection,
  type CpSettings as CpSettingsData,
  type CpSettingsPatch,
} from '@/lib/crm/cp-api';
import {
  comfyGatewayInputValue,
  comfySettingsStatusCopy,
} from '@/lib/crm/cp-ai-ops-panes.util';
import { CP_SUBTITLES } from '@/lib/crm/cp-copy';
import { dash } from '@/lib/crm/cp-format';

export const CP_SETTINGS_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'members', label: 'Members' },
  { id: 'sso', label: 'SSO' },
  { id: 'credit', label: 'Credit' },
  { id: 'models', label: 'Models' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'security', label: 'Security' },
  { id: 'policy', label: 'Policy' },
] as const;

type SettingsTab = (typeof CP_SETTINGS_TABS)[number]['id'];

const CP_PLATFORM_MAP = [
  { screen: 'SET-01 Profile', cp: 'locale UI module, TZ, default kit, quota display, retention ngày', platform: 'Tên/logo tenant' },
  { screen: 'SET-02 Members', cp: 'Project member invite expiry + role CP', platform: 'Staff invite / job function' },
  { screen: 'SET-03 SSO', cp: 'Link “Mở Admin SSO”', platform: 'SAML/OIDC/SCIM' },
  { screen: 'SET-04 Credit', cp: 'Grant/allocate/alert 50/80/100, ledger', platform: 'Không invoice SaaS' },
  { screen: 'SET-05 Models', cp: 'allowlist, max res/duration, cap, region, fallback', platform: 'Secret vault' },
  { screen: 'SET-06 Integrations', cp: 'webhook CP, Campaign Write, Content OS, Hub', platform: 'API key platform' },
  { screen: 'SET-07 Security', cp: 'retention, legal hold flag, signed URL TTL, audit query', platform: 'IP allowlist / MFA' },
  { screen: 'SET-08 Policy', cp: 'moderation Block/Review/Allow, watermark, escalate', platform: 'Không lộ rule nhạy ra client' },
] as const;

function parseTab(value: string | null): SettingsTab {
  return CP_SETTINGS_TABS.some((tab) => tab.id === value)
    ? value as SettingsTab
    : 'profile';
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function formText(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
}

function SettingsForm({
  children,
  onSubmit,
  saving,
}: {
  children: React.ReactNode;
  onSubmit: (form: FormData) => Promise<void>;
  saving: boolean;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(new FormData(event.currentTarget));
  }

  return (
    <form className="cp-card cp-filters" onSubmit={(event) => void submit(event)}>
      {children}
      <button className="cp-btn cp-btn--primary" type="submit" disabled={saving}>
        {saving ? 'Đang lưu…' : 'Lưu'}
      </button>
    </form>
  );
}

function EmptyTable({ columns }: { columns: string[] }) {
  return (
    <section className="cp-card">
      <div className="cp-table-wrap">
        <table className="cp-table">
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            <tr><td className="cp-empty" colSpan={columns.length}>{dash(null)}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CpSettings() {
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const [settings, setSettings] = useState<CpSettingsData | null>(null);
  const [models, setModels] = useState<CpModelSetting[]>([]);
  const [policy, setPolicy] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connections, setConnections] = useState<CpProviderConnection[]>([]);
  const [magnificApiKey, setMagnificApiKey] = useState('');
  const [comfyGateway, setComfyGateway] = useState('');
  const oauthResult = searchParams.get('magnific_oauth');

  const tabLinks = useMemo(() => CP_SETTINGS_TABS.map((item) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', item.id);
    return { ...item, href: `/crm/creative-os/settings?${params.toString()}` };
  }), [searchParams]);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = projectCpSettingsForUi(await getCpSettings(token));
      setSettings(result);
      setModels(result?.models_json ?? []);
      setPolicy(result?.policy_json ?? {});
    } catch (err) {
      setSettings(null);
      setError(formatCpApiError(err, 'Không tải được cấu hình'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConnections = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const result = await listCpProviderConnections(token);
      setConnections(result.items ?? []);
    } catch (err) {
      setError(formatCpApiError(err, 'Không tải được kết nối Magnific'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === 'integrations') void loadConnections();
  }, [tab, loadConnections]);

  useEffect(() => {
    if (oauthResult === 'ok') setNotice('Đã kết nối Magnific MCP');
    if (oauthResult === 'error' || oauthResult === 'err') {
      setError('Không kết nối được Magnific MCP');
    }
  }, [oauthResult]);

  async function save(input: CpSettingsPatch) {
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = projectCpSettingsForUi(await patchCpSettings(token, input));
      setSettings(result);
      setModels(result?.models_json ?? []);
      setPolicy(result?.policy_json ?? {});
      setNotice('Đã lưu cấu hình');
    } catch (err) {
      setError(formatCpApiError(err, 'Không lưu được cấu hình'));
    } finally {
      setSaving(false);
    }
  }

  function updateModel(index: number, field: (typeof CP_MODEL_FIELDS)[number], value: string) {
    setModels((current) => current.map((model, modelIndex) => (
      modelIndex === index ? { ...model, [field]: value || null } : model
    )));
  }

  function updatePolicyValue(key: string, value: string) {
    setPolicy((current) => {
      const previous = current[key];
      const next = typeof previous === 'number'
        ? Number(value)
        : typeof previous === 'boolean'
          ? value === 'true'
          : value;
      return { ...current, [key]: next };
    });
  }

  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    const form = new FormData(formElement);
    const agencyClientId = String(form.get('agency_client_id') ?? '').trim();
    const amount = optionalNumber(form.get('amount'));
    if (!agencyClientId || amount == null || amount < 0) {
      setError('Agency client ID và số credit không âm là bắt buộc');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await grantCpCredits(token, {
        agency_client_id: agencyClientId,
        amount,
        cost_center: String(form.get('cost_center') ?? '').trim() || null,
      }, crypto.randomUUID());
      formElement.reset();
      setNotice('Đã cấp credit');
    } catch (err) {
      setError(formatCpApiError(err, 'Không cấp được credit'));
    } finally {
      setSaving(false);
    }
  }

  async function connectMagnificMcp() {
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const started = await startMagnificOAuth(token);
      if (!started.authorize_url) {
        setError('Không tạo được liên kết Magnific MCP');
        return;
      }
      window.location.assign(started.authorize_url);
    } catch (err) {
      setError(formatCpApiError(err, 'Không kết nối được Magnific MCP'));
    } finally {
      setSaving(false);
    }
  }

  async function saveMagnificKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    const apiKey = magnificApiKey.trim();
    if (!apiKey) {
      setError('API key Magnific là bắt buộc');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveMagnificRestKey(token, apiKey);
      setMagnificApiKey('');
      await loadConnections();
      setNotice('Đã lưu API key Magnific');
    } catch (err) {
      setError(formatCpApiError(err, 'Không lưu được API key Magnific'));
    } finally {
      setSaving(false);
    }
  }

  function saveComfyGateway(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setComfyGateway(comfyGatewayInputValue(comfyGateway));
    setError('');
    setNotice('Đã nhận URL gateway — không hiện lại trên giao diện.');
  }

  async function disconnectConnection(id: string) {
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await disconnectCpProviderConnection(token, id);
      await loadConnections();
      setNotice('Đã ngắt kết nối Magnific');
    } catch (err) {
      setError(formatCpApiError(err, 'Không ngắt được kết nối Magnific'));
    } finally {
      setSaving(false);
    }
  }

  const magnificMcp = connections.find((row) => row.provider === 'magnific_mcp');
  const magnificRest = connections.find((row) => row.provider === 'magnific_rest');

  return (
    <div className="cp-overview">
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Cấu hình</p>
          <h1>Cấu hình module</h1>
          <p className="cp-muted">
            {tab === 'integrations'
              ? CP_SUBTITLES.setIntegrations
              : tab === 'policy'
                ? CP_SUBTITLES.setPolicy
                : tab === 'profile'
                  ? CP_SUBTITLES.setProfile
                  : 'Thiết lập vận hành Creative Production OS.'}
          </p>
        </div>
      </header>

      <nav className="cp-card cp-settings-tabs" aria-label="Cấu hình">
        {tabLinks.map((item) => (
          <Link
            key={item.id}
            className={`cp-btn${item.id === tab ? ' cp-btn--primary' : ''}`}
            href={item.href}
            aria-current={item.id === tab ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
          <button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button>
        </section>
      ) : null}
      {notice ? <p className="cp-alert">{notice}</p> : null}
      {loading ? <section className="cp-card"><p className="cp-muted">Đang tải…</p></section> : null}

      {!loading && tab === 'profile' ? (
        <SettingsForm
          saving={saving}
          onSubmit={(form) => save({
            locale: String(form.get('locale') ?? '').trim() || null,
            timezone: String(form.get('timezone') ?? '').trim() || null,
            default_brand_kit_id: String(form.get('default_brand_kit_id') ?? '').trim() || null,
            retention_days: optionalNumber(form.get('retention_days')),
          })}
        >
          <label><span>Locale UI</span><input name="locale" required defaultValue={formText(settings?.locale)} placeholder="—" /></label>
          <label><span>Timezone</span><input name="timezone" required defaultValue={formText(settings?.timezone)} placeholder="—" /></label>
          <label><span>Default Brand Kit ID</span><input name="default_brand_kit_id" defaultValue={formText(settings?.default_brand_kit_id)} placeholder="—" /></label>
          <label><span>Retention asset (ngày)</span><input name="retention_days" type="number" min="0" required defaultValue={formText(settings?.retention_days)} placeholder="—" /></label>
        </SettingsForm>
      ) : null}

      {!loading && tab === 'members' ? (
        <EmptyTable columns={['Staff', 'Role CP', 'Project scope', 'Expiry invite']} />
      ) : null}

      {!loading && tab === 'sso' ? (
        <section className="cp-card">
          <Link className="cp-btn cp-btn--primary" href="/admin/crm/sso/groups">Mở Admin SSO</Link>
        </section>
      ) : null}

      {!loading && tab === 'credit' ? (
        <>
          <form className="cp-card cp-filters" onSubmit={(event) => void grant(event)}>
            <label><span>Agency client ID</span><input name="agency_client_id" required placeholder="—" /></label>
            <label><span>Số credit</span><input name="amount" type="number" min="0" step="1" required placeholder="—" /></label>
            <label><span>Cost center</span><input name="cost_center" placeholder="—" /></label>
            <button className="cp-btn cp-btn--primary" type="submit" disabled={saving}>{saving ? 'Đang cấp…' : 'Grant'}</button>
          </form>
          <EmptyTable columns={['Khách hàng', 'Allocated', 'Alert', 'Hard cap']} />
        </>
      ) : null}

      {!loading && tab === 'models' ? (
        <section className="cp-card">
          <div className="cp-card__head">
            <div>
              <h2>AI Providers & Models</h2>
              <p className="cp-muted">Chỉ lưu id, max_res, max_duration_sec, cap_per_job, region và fallback_id.</p>
            </div>
            <div>
              <button className="cp-btn" type="button" onClick={() => setModels((current) => [...current, {}])}>Thêm model</button>
              <button className="cp-btn cp-btn--primary" type="button" disabled={saving} onClick={() => void save({ models_json: models })}>Lưu models</button>
            </div>
          </div>
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>{CP_MODEL_FIELDS.map((field) => <th key={field}>{field}</th>)}</tr>
              </thead>
              <tbody>
                {models.length ? models.map((model, index) => (
                  <tr key={`${String(model.id ?? 'model')}-${index}`}>
                    {CP_MODEL_FIELDS.map((field) => (
                      <td key={field}>
                        <input
                          className="cp-settings-input"
                          aria-label={`${field} model ${index + 1}`}
                          value={formText(model[field] as string | number | null)}
                          placeholder="—"
                          onChange={(event) => updateModel(index, field, event.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr><td className="cp-empty" colSpan={CP_MODEL_FIELDS.length}>{dash(null)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!loading && tab === 'integrations' ? (
        <>
          <section className="cp-card">
            <div className="cp-card__head">
              <div>
                <h2>Magnific</h2>
                <p className="cp-muted">
                  Kết nối MCP bằng OAuth hoặc lưu API key REST. Key không hiển thị lại sau khi lưu.
                </p>
              </div>
            </div>
            <div className="cp-filters">
              <p>
                MCP:{' '}
                <span className={`cp-pill${magnificMcp?.status === 'on' ? ' cp-pill--ok' : ''}`}>
                  {magnificMcp?.status === 'on' ? 'Đã kết nối' : 'Chưa kết nối'}
                </span>
                {magnificMcp?.account_label ? ` · ${magnificMcp.account_label}` : ''}
              </p>
              <button
                className="cp-btn cp-btn--primary"
                type="button"
                disabled={saving}
                onClick={() => void connectMagnificMcp()}
              >
                Connect Magnific MCP
              </button>
              {magnificMcp?.status === 'on' ? (
                <button
                  className="cp-btn"
                  type="button"
                  disabled={saving}
                  onClick={() => void disconnectConnection(magnificMcp.id)}
                >
                  Ngắt kết nối MCP
                </button>
              ) : null}
            </div>
            <form className="cp-filters" onSubmit={(event) => void saveMagnificKey(event)}>
              <p>
                REST:{' '}
                <span className={`cp-pill${magnificRest?.status === 'on' ? ' cp-pill--ok' : ''}`}>
                  {magnificRest?.status === 'on' && magnificRest.has_secret ? 'Đã lưu key' : 'Chưa có key'}
                </span>
              </p>
              <label>
                <span>API key Magnific</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={magnificApiKey}
                  onChange={(event) => setMagnificApiKey(event.target.value)}
                  placeholder="Nhập key — không hiện lại sau khi lưu"
                />
              </label>
              <button className="cp-btn cp-btn--primary" type="submit" disabled={saving}>
                {saving ? 'Đang lưu…' : 'Lưu API key'}
              </button>
              {magnificRest?.status === 'on' ? (
                <button
                  className="cp-btn"
                  type="button"
                  disabled={saving}
                  onClick={() => void disconnectConnection(magnificRest.id)}
                >
                  Ngắt kết nối REST
                </button>
              ) : null}
            </form>
          </section>
          <section className="cp-card" data-testid="cp-settings-comfy">
            <div className="cp-card__head">
              <div>
                <h2>Comfy</h2>
                <p className="cp-muted">{comfySettingsStatusCopy()}</p>
              </div>
            </div>
            <form className="cp-filters" onSubmit={(event) => saveComfyGateway(event)}>
              <label>
                <span>URL gateway (nội bộ)</span>
                <input
                  type="password"
                  autoComplete="off"
                  data-testid="cp-settings-comfy-gateway"
                  value={comfyGateway}
                  onChange={(event) => setComfyGateway(event.target.value)}
                  placeholder="Nhập URL — không hiện lại sau khi lưu"
                />
              </label>
              <button className="cp-btn" type="submit" disabled={saving}>
                Lưu URL gateway
              </button>
            </form>
          </section>
          <section className="cp-card">
            <div className="cp-card__head">
              <h2>Trạng thái tích hợp</h2>
            </div>
            <div className="cp-table-wrap">
              <table className="cp-table">
                <thead><tr><th>Hệ</th><th>Status</th><th>Ghi chú</th></tr></thead>
                <tbody>
                  <tr><td>Creative Hub / portal</td><td><span className="cp-pill cp-pill--ok">ON</span></td><td>submit creative</td></tr>
                  <tr><td>Content OS</td><td><span className="cp-pill cp-pill--ok">ON</span></td><td>cite + ủy quyền generate W2</td></tr>
                  <tr><td>Campaign Write</td><td><span className="cp-pill cp-pill--ok">ON</span></td><td>handoff file + UTM</td></tr>
                  <tr><td>Webhook CP</td><td><span className="cp-pill">OFF</span></td><td>signing secret 1 lần</td></tr>
                  <tr>
                    <td>Social native</td>
                    <td><span className="cp-pill cp-pill--warning">FLAG</span></td>
                    <td>{settings?.publish_native == null ? 'CP_PUBLISH_NATIVE' : settings.publish_native ? 'ON' : 'OFF'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section className="cp-card cp-platform-map">
            <div className="cp-card__head">
              <h2>Platform vs CP</h2>
              <p className="cp-muted">Map module cấu hình — CP làm gì vs platform giữ gì (SRS MOD-SET).</p>
            </div>
            <div className="cp-table-wrap">
              <table className="cp-table">
                <thead>
                  <tr>
                    <th>Màn</th>
                    <th>CP làm</th>
                    <th>Platform giữ</th>
                  </tr>
                </thead>
                <tbody>
                  {CP_PLATFORM_MAP.map((row) => (
                    <tr key={row.screen}>
                      <td>{row.screen}</td>
                      <td>{row.cp}</td>
                      <td>{row.platform}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {!loading && tab === 'security' ? (
        <SettingsForm
          saving={saving}
          onSubmit={(form) => save({
            signed_url_ttl_min: optionalNumber(form.get('signed_url_ttl_min')),
            restore_days: optionalNumber(form.get('restore_days')),
            legal_hold: form.get('legal_hold') === 'on',
          })}
        >
          <label><span>Signed URL TTL (phút)</span><input name="signed_url_ttl_min" type="number" min="0" required defaultValue={formText(settings?.signed_url_ttl_min)} placeholder="—" /></label>
          <label><span>Restore period (ngày)</span><input name="restore_days" type="number" min="0" required defaultValue={formText(settings?.restore_days)} placeholder="—" /></label>
          <label><span>Legal hold</span><input name="legal_hold" type="checkbox" defaultChecked={settings?.legal_hold === true} /></label>
        </SettingsForm>
      ) : null}

      {!loading && tab === 'policy' ? (
        <section className="cp-card">
          <div className="cp-card__head">
            <div>
              <h2>Content Policy</h2>
              <p className="cp-muted">Chỉ hiển thị trường policy an toàn.</p>
            </div>
            <button className="cp-btn cp-btn--primary" type="button" disabled={saving} onClick={() => void save({ policy_json: policy })}>Lưu policy</button>
          </div>
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead><tr><th>Policy</th><th>Giá trị</th></tr></thead>
              <tbody>
                {Object.entries(policy).length ? Object.entries(policy).map(([key, value]) => {
                  const nested = value !== null && typeof value === 'object';
                  return (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>
                        <input
                          className="cp-settings-input"
                          aria-label={`Policy ${key}`}
                          value={nested ? (Array.isArray(value) ? 'Danh sách' : 'Cấu hình lồng') : String(value ?? '')}
                          disabled={nested}
                          placeholder="—"
                          onChange={(event) => updatePolicyValue(key, event.target.value)}
                        />
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td className="cp-empty" colSpan={2}>{dash(null)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
