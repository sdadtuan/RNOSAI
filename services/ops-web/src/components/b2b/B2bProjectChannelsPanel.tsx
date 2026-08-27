'use client';

import { useEffect, useState } from 'react';
import {
  Form,
  FormField,
  FormFooter,
  FormGrid,
  FormInput,
  FormSelect,
} from '@/components/form';
import {
  replaceB2bProjectChannels,
  replaceB2bProjectPages,
  syncB2bProjectFacebookLeads,
  type B2bProjectChannelRow,
  type B2bProjectPageRow,
} from '@/lib/b2b-projects-api';
import { getAccessToken } from '@/lib/auth';

export type PageDraft = {
  page_id: string;
  name: string;
  token_ref: string;
  active: boolean;
  forms: FormDraft[];
};

export type FormDraft = {
  form_id: string;
  name: string;
  active: boolean;
};

export type ChannelDraft = {
  channel_type: 'zalo' | 'webform' | 'api';
  external_key: string;
  label: string;
  active: boolean;
};

function pagesToDraft(rows: B2bProjectPageRow[]): PageDraft[] {
  return rows.map((p) => ({
    page_id: p.page_id,
    name: p.name ?? '',
    token_ref: p.token_ref ?? '',
    active: p.active,
    forms: (p.forms ?? []).map((f) => ({
      form_id: f.form_id,
      name: f.name ?? '',
      active: f.active,
    })),
  }));
}

function channelsToDraft(rows: B2bProjectChannelRow[]): ChannelDraft[] {
  return rows.map((c) => ({
    channel_type: (c.channel_type as ChannelDraft['channel_type']) || 'zalo',
    external_key: c.external_key,
    label: c.label ?? '',
    active: c.active,
  }));
}

const CHANNEL_TYPE_LABELS: Record<ChannelDraft['channel_type'], string> = {
  zalo: 'Zalo OA',
  webform: 'Webform / Landing',
  api: 'API key',
};

type Props = {
  projectId: string;
  projectCode: string;
  pages: B2bProjectPageRow[];
  channels: B2bProjectChannelRow[];
  canManage: boolean;
  onSaved?: () => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
};

export function B2bProjectChannelsPanel({
  projectId,
  projectCode,
  pages,
  channels,
  canManage,
  onSaved,
  onMessage,
  onError,
}: Props) {
  const [pagesDraft, setPagesDraft] = useState<PageDraft[]>([]);
  const [channelsDraft, setChannelsDraft] = useState<ChannelDraft[]>([]);
  const [savingPages, setSavingPages] = useState(false);
  const [savingChannels, setSavingChannels] = useState(false);
  const [syncingFacebook, setSyncingFacebook] = useState(false);

  useEffect(() => {
    setPagesDraft(pagesToDraft(pages));
  }, [pages]);

  useEffect(() => {
    setChannelsDraft(channelsToDraft(channels));
  }, [channels]);

  function apiErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) {
      if (err.message.includes('channel_key_taken')) {
        return 'Page/Form hoặc kênh đã được map ở dự án PTT khác — kiểm tra /crm/b2b-unmatched.';
      }
      if (err.message.includes('missing_page_token')) {
        return 'Thiếu Page Access Token. Lưu token ở tab Kênh hoặc CRM_FACEBOOK_PAGE_ACCESS_TOKEN rồi thử lại.';
      }
      if (err.message.includes('no_active_forms')) {
        return 'Dự án chưa có Form Facebook active để đồng bộ.';
      }
      return err.message;
    }
    return fallback;
  }

  async function savePages(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !canManage) return;
    setSavingPages(true);
    onError?.('');
    try {
      const payload = pagesDraft
        .filter((p) => p.page_id.trim())
        .map((p) => ({
          page_id: p.page_id.trim(),
          name: p.name.trim() || undefined,
          token_ref: p.token_ref.trim() || undefined,
          active: p.active,
          forms: p.forms
            .filter((f) => f.form_id.trim())
            .map((f) => ({
              form_id: f.form_id.trim(),
              name: f.name.trim() || undefined,
              active: f.active,
            })),
        }));
      await replaceB2bProjectPages(access, projectId, payload);
      onMessage?.('Đã lưu Facebook pages & forms.');
      onSaved?.();
    } catch (err) {
      onError?.(apiErrorMessage(err, 'Lưu pages thất bại'));
    } finally {
      setSavingPages(false);
    }
  }

  async function saveChannels(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !canManage) return;
    setSavingChannels(true);
    onError?.('');
    try {
      const payload = channelsDraft
        .filter((c) => c.external_key.trim())
        .map((c) => ({
          channel_type: c.channel_type,
          external_key: c.external_key.trim(),
          label: c.label.trim() || undefined,
          active: c.active,
        }));
      await replaceB2bProjectChannels(access, projectId, payload);
      onMessage?.('Đã lưu kênh Zalo / Webform / API.');
      onSaved?.();
    } catch (err) {
      onError?.(apiErrorMessage(err, 'Lưu kênh thất bại'));
    } finally {
      setSavingChannels(false);
    }
  }

  async function syncFacebookLeads() {
    const access = getAccessToken();
    if (!access || !canManage) return;
    setSyncingFacebook(true);
    onError?.('');
    try {
      const out = await syncB2bProjectFacebookLeads(access, projectId);
      onMessage?.(out.message || 'Đã đồng bộ lead Facebook.');
    } catch (err) {
      onError?.(apiErrorMessage(err, 'Đồng bộ Facebook thất bại'));
    } finally {
      setSyncingFacebook(false);
    }
  }

  function updatePage(idx: number, patch: Partial<PageDraft>) {
    setPagesDraft((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function updatePageForm(pageIdx: number, formIdx: number, patch: Partial<FormDraft>) {
    setPagesDraft((prev) =>
      prev.map((p, i) =>
        i === pageIdx
          ? {
              ...p,
              forms: p.forms.map((f, j) => (j === formIdx ? { ...f, ...patch } : f)),
            }
          : p,
      ),
    );
  }

  return (
    <div className="stack-gap" style={{ gap: '1.5rem' }}>
      <p className="muted" style={{ margin: 0 }}>
        Map Page/Form Meta và OA Zalo/Webform vào dự án <code>{projectCode}</code>. Lead không map sẽ rơi{' '}
        <a href="/crm/b2b-unmatched" className="nav-link">
          Ingress chưa map
        </a>
        .
      </p>

      <Form className="stack-gap" onSubmit={(e) => void savePages(e)}>
        <h3 className="form-section-title" style={{ margin: 0 }}>
          Facebook pages & Lead forms
        </h3>
        <p className="muted" style={{ margin: 0 }}>
          Nút <strong>Đồng bộ lead Facebook</strong> kéo lead đã có trên Instant Form (tối đa 50 / lần) vào inbox dự
          án. Lead trùng <code>leadgen_id</code> không tạo lại.
        </p>
        {pagesDraft.length === 0 ? (
          <p className="muted">Chưa có page. Bấm &quot;+ Thêm Page&quot; để map Page ID và Form ID từ Meta.</p>
        ) : null}
        {pagesDraft.map((page, pageIdx) => (
          <div
            key={`page-${pageIdx}`}
            className="form-section"
            style={{ padding: '0.75rem', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)' }}
          >
            <FormGrid cols={2}>
              <FormField label="Page ID (Meta)" hint="ID Facebook Page">
                <FormInput
                  value={page.page_id}
                  disabled={!canManage || savingPages}
                  placeholder="vd: 123456789012345"
                  onChange={(e) => updatePage(pageIdx, { page_id: e.target.value })}
                />
              </FormField>
              <FormField label="Tên page (tuỳ chọn)">
                <FormInput
                  value={page.name}
                  disabled={!canManage || savingPages}
                  onChange={(e) => updatePage(pageIdx, { name: e.target.value })}
                />
              </FormField>
              <FormField
                label="Page Access Token"
                hint="Token Page (leads_retrieval). Dùng để Graph lấy SĐT/tên từ leadgen_id."
              >
                <FormInput
                  type="password"
                  autoComplete="off"
                  value={page.token_ref}
                  disabled={!canManage || savingPages}
                  placeholder="EAAx…"
                  onChange={(e) => updatePage(pageIdx, { token_ref: e.target.value })}
                />
              </FormField>
              <FormField label="Trạng thái">
                <FormSelect
                  value={page.active ? 'yes' : 'no'}
                  disabled={!canManage || savingPages}
                  onChange={(e) => updatePage(pageIdx, { active: e.target.value === 'yes' })}
                >
                  <option value="yes">Active</option>
                  <option value="no">Inactive</option>
                </FormSelect>
              </FormField>
            </FormGrid>

            <p className="form-section-title" style={{ fontSize: '0.875rem', marginTop: '0.75rem' }}>
              Lead forms thuộc page
            </p>
            {page.forms.map((form, formIdx) => (
              <FormGrid cols={3} key={`form-${pageIdx}-${formIdx}`}>
                <FormField label="Form ID">
                  <FormInput
                    value={form.form_id}
                    disabled={!canManage || savingPages}
                    placeholder="Lead Ads form ID"
                    onChange={(e) => updatePageForm(pageIdx, formIdx, { form_id: e.target.value })}
                  />
                </FormField>
                <FormField label="Tên form">
                  <FormInput
                    value={form.name}
                    disabled={!canManage || savingPages}
                    onChange={(e) => updatePageForm(pageIdx, formIdx, { name: e.target.value })}
                  />
                </FormField>
                <FormField label="Active">
                  <FormSelect
                    value={form.active ? 'yes' : 'no'}
                    disabled={!canManage || savingPages}
                    onChange={(e) => updatePageForm(pageIdx, formIdx, { active: e.target.value === 'yes' })}
                  >
                    <option value="yes">Có</option>
                    <option value="no">Không</option>
                  </FormSelect>
                </FormField>
                {canManage ? (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      disabled={savingPages}
                      onClick={() =>
                        setPagesDraft((prev) =>
                          prev.map((p, i) =>
                            i === pageIdx ? { ...p, forms: p.forms.filter((_, j) => j !== formIdx) } : p,
                          ),
                        )
                      }
                    >
                      Xóa form
                    </button>
                  </div>
                ) : null}
              </FormGrid>
            ))}

            {canManage ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  disabled={savingPages}
                  onClick={() =>
                    setPagesDraft((prev) =>
                      prev.map((p, i) =>
                        i === pageIdx ? { ...p, forms: [...p.forms, { form_id: '', name: '', active: true }] } : p,
                      ),
                    )
                  }
                >
                  + Thêm form
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  disabled={savingPages}
                  onClick={() => setPagesDraft((prev) => prev.filter((_, i) => i !== pageIdx))}
                >
                  Xóa page
                </button>
              </div>
            ) : null}
          </div>
        ))}

        {canManage ? (
          <FormFooter>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={savingPages}
              onClick={() =>
                setPagesDraft((prev) => [
                  ...prev,
                  { page_id: '', name: '', token_ref: '', active: true, forms: [{ form_id: '', name: '', active: true }] },
                ])
              }
            >
              + Thêm Page
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={savingPages || syncingFacebook}
              onClick={() => void syncFacebookLeads()}
            >
              {syncingFacebook ? 'Đang kéo lead…' : 'Đồng bộ lead Facebook'}
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={savingPages || syncingFacebook}>
              {savingPages ? 'Đang lưu…' : 'Lưu Meta pages'}
            </button>
          </FormFooter>
        ) : null}
      </Form>

      <Form className="stack-gap" onSubmit={(e) => void saveChannels(e)}>
        <h3 className="form-section-title" style={{ margin: 0 }}>
          Zalo / Webform / API
        </h3>
        <p className="muted" style={{ margin: 0 }}>
          Webhook ingest: <code>/api/v1/webhooks/zalo/{projectCode}</code>
        </p>

        {channelsDraft.map((ch, idx) => (
          <FormGrid cols={2} key={`ch-${idx}`}>
            <FormField label="Loại kênh">
              <FormSelect
                value={ch.channel_type}
                disabled={!canManage || savingChannels}
                onChange={(e) =>
                  setChannelsDraft((prev) =>
                    prev.map((c, i) => (i === idx ? { ...c, channel_type: e.target.value as ChannelDraft['channel_type'] } : c)),
                  )
                }
              >
                {(Object.keys(CHANNEL_TYPE_LABELS) as ChannelDraft['channel_type'][]).map((t) => (
                  <option key={t} value={t}>
                    {CHANNEL_TYPE_LABELS[t]}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField
              label={ch.channel_type === 'zalo' ? 'OA ID' : ch.channel_type === 'webform' ? 'Slug webform' : 'API key / hash'}
            >
              <FormInput
                value={ch.external_key}
                disabled={!canManage || savingChannels}
                placeholder={
                  ch.channel_type === 'zalo' ? 'Zalo OA ID' : ch.channel_type === 'webform' ? 'landing-slug' : 'api-key-id'
                }
                onChange={(e) =>
                  setChannelsDraft((prev) => prev.map((c, i) => (i === idx ? { ...c, external_key: e.target.value } : c)))
                }
              />
            </FormField>
            <FormField label="Nhãn (tuỳ chọn)">
              <FormInput
                value={ch.label}
                disabled={!canManage || savingChannels}
                onChange={(e) =>
                  setChannelsDraft((prev) => prev.map((c, i) => (i === idx ? { ...c, label: e.target.value } : c)))
                }
              />
            </FormField>
            <FormField label="Active">
              <FormSelect
                value={ch.active ? 'yes' : 'no'}
                disabled={!canManage || savingChannels}
                onChange={(e) =>
                  setChannelsDraft((prev) =>
                    prev.map((c, i) => (i === idx ? { ...c, active: e.target.value === 'yes' } : c)),
                  )
                }
              >
                <option value="yes">Có</option>
                <option value="no">Không</option>
              </FormSelect>
            </FormField>
            {canManage ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  disabled={savingChannels}
                  onClick={() => setChannelsDraft((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Xóa kênh
                </button>
              </div>
            ) : null}
          </FormGrid>
        ))}

        {channelsDraft.length === 0 ? <p className="muted">Chưa có kênh Zalo/Webform/API.</p> : null}

        {canManage ? (
          <FormFooter>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={savingChannels}
              onClick={() =>
                setChannelsDraft((prev) => [...prev, { channel_type: 'zalo', external_key: '', label: '', active: true }])
              }
            >
              + Thêm kênh
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={savingChannels}>
              {savingChannels ? 'Đang lưu…' : 'Lưu kênh khác'}
            </button>
          </FormFooter>
        ) : null}
      </Form>
    </div>
  );
}
